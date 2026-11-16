<?php

// One-time operator tool; never expose through HTTP or run tests on a live target.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

function snapshotRequire(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function snapshotTables(Connection $db): array
{
    $schema = $db->getDriverName() === 'pgsql'
        ? $db->selectOne('select current_schema() as name')->name
        : $db->getDatabaseName();
    $tables = array_column($db->getSchemaBuilder()->getTables($schema), 'name');
    sort($tables);

    return $tables;
}

function snapshotCanonical(mixed $value): mixed
{
    if (is_object($value)) {
        $properties = get_object_vars($value);
        ksort($properties);

        return (object) array_map('snapshotCanonical', $properties);
    }
    if (! is_array($value)) {
        return $value;
    }
    if (! array_is_list($value)) {
        ksort($value);
    }

    return array_map('snapshotCanonical', $value);
}

function snapshotDigest(array $rows, array $types): string
{
    $hashes = [];
    foreach ($rows as $row) {
        foreach ($row as $column => &$value) {
            if ($value === null) {
                continue;
            }
            $type = $types[$column];
            $value = match (true) {
                in_array($type, ['bool', 'boolean'], true) => in_array($value, [true, 1, '1', 't', 'true'], true) ? '1' : '0',
                in_array($type, ['json', 'jsonb'], true) => snapshotCanonical(json_decode((string) $value, false, 512, JSON_THROW_ON_ERROR)),
                str_starts_with($type, 'timestamp') => (new DateTimeImmutable((string) $value))->format('Y-m-d H:i:s.u'),
                default => (string) $value,
            };
        }
        unset($value);
        ksort($row);
        $hashes[] = hash('sha256', json_encode($row, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
    }
    sort($hashes);

    return hash('sha256', implode('', $hashes));
}

function snapshotCheck(Connection $db, array $tables): void
{
    foreach ($tables as $table => $rows) {
        $types = array_column($db->getSchemaBuilder()->getColumns($table), 'type_name', 'name');
        $actual = $db->table($table)->get()->map(fn ($row) => (array) $row)->all();
        snapshotRequire(count($rows) === count($actual), "Row count differs: {$table}");
        snapshotRequire(snapshotDigest($rows, $types) === snapshotDigest($actual, $types), "Content differs: {$table}");
        echo $table.': '.count($rows)." rows verified\n";
    }
}

try {
    [$script, $mode, $path] = array_pad($argv, 3, null);
    snapshotRequire(in_array($mode, ['export', 'import', 'verify'], true) && is_string($path), 'Usage: php scripts/db-snapshot.php export|import|verify /private/snapshot.json');
    $db = DB::connection();
    $db->disableQueryLog();
    $tableNames = snapshotTables($db);

    if ($mode === 'export') {
        snapshotRequire($db->getDriverName() === 'mysql', 'Export requires MySQL.');
        snapshotRequire(! file_exists($path), 'Snapshot already exists; choose a new path.');
        $db->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $db->beginTransaction();
        $tables = [];
        // ponytail: bounded in-memory snapshot for this small production DB; use streaming transport above 16 MiB.
        foreach ($tableNames as $table) {
            snapshotRequire($db->table($table)->count() <= 100000, "Table exceeds snapshot row limit: {$table}");
            $tables[$table] = $db->table($table)->get()->map(fn ($row) => (array) $row)->all();
            snapshotRequire(strlen(json_encode($tables, JSON_THROW_ON_ERROR)) <= 16 * 1024 * 1024, 'Snapshot exceeds 16 MiB; use a streaming migration.');
        }
        $data = json_encode($tables, JSON_THROW_ON_ERROR);
        $snapshot = json_encode(['format' => 'cod-mysql-snapshot-v1', 'tables_sha256' => hash('sha256', $data), 'tables' => $tables], JSON_THROW_ON_ERROR);
        $db->commit();
        $previousMask = umask(0077);
        $file = fopen($path, 'x');
        umask($previousMask);
        snapshotRequire($file !== false, 'Cannot create private snapshot.');
        try {
            snapshotRequire(fwrite($file, $snapshot) === strlen($snapshot), 'Incomplete snapshot write.');
            snapshotRequire(fflush($file), 'Cannot flush snapshot.');
        } finally {
            fclose($file);
        }
        echo 'Exported '.count($tables).' tables. SHA256: '.hash_file('sha256', $path)."\n";
        exit(0);
    }

    snapshotRequire($db->getDriverName() === 'pgsql', 'Import/verify requires PostgreSQL.');
    snapshotRequire(is_file($path) && filesize($path) <= 17 * 1024 * 1024, 'Missing or oversized snapshot.');
    $snapshot = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    snapshotRequire(($snapshot['format'] ?? null) === 'cod-mysql-snapshot-v1', 'Unsupported snapshot format.');
    $tables = $snapshot['tables'] ?? [];
    snapshotRequire(hash_equals($snapshot['tables_sha256'], hash('sha256', json_encode($tables, JSON_THROW_ON_ERROR))), 'Snapshot checksum failed.');
    $sourceTables = array_keys($tables);
    sort($sourceTables);
    snapshotRequire($sourceTables === $tableNames, 'Source and target table sets differ; check migrations and DB_SCHEMA.');

    if ($mode === 'verify') {
        $db->transaction(function () use ($db, $tables) {
            $db->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
            snapshotCheck($db, $tables);
        });
        exit(0);
    }

    $db->transaction(function () use ($db, $tables, $tableNames) {
        $grammar = $db->getQueryGrammar();
        $db->statement("SET LOCAL lock_timeout = '5s'");
        $db->statement('LOCK TABLE '.implode(', ', array_map(fn ($t) => $grammar->wrapTable($t), $tableNames)).' IN ACCESS EXCLUSIVE MODE');
        foreach ($tableNames as $table) {
            if ($table !== 'migrations') {
                snapshotRequire($db->table($table)->count() === 0, "Target table is not empty: {$table}");
            }
            $sourceColumns = array_keys($tables[$table][0] ?? []);
            if ($sourceColumns !== []) {
                $targetColumns = array_column($db->getSchemaBuilder()->getColumns($table), 'name');
                sort($sourceColumns);
                sort($targetColumns);
                snapshotRequire($sourceColumns === $targetColumns, "Columns differ: {$table}");
            }
        }
        $sourceMigrations = array_column($tables['migrations'], 'migration');
        $targetMigrations = $db->table('migrations')->pluck('migration')->all();
        sort($sourceMigrations);
        sort($targetMigrations);
        snapshotRequire($sourceMigrations === $targetMigrations, 'Migration histories differ.');

        $remaining = $tableNames;
        $ordered = [];
        while ($remaining !== []) {
            $before = count($remaining);
            foreach ($remaining as $i => $table) {
                $dependencies = array_column($db->getSchemaBuilder()->getForeignKeys($table), 'foreign_table');
                if (array_diff($dependencies, $ordered) === []) {
                    $ordered[] = $table;
                    unset($remaining[$i]);
                }
            }
            snapshotRequire(count($remaining) < $before, 'Foreign-key cycle or dependency outside target schema.');
        }
        $db->table('migrations')->delete();
        foreach ($ordered as $table) {
            foreach (array_chunk($tables[$table], 100) as $chunk) {
                $db->table($table)->insert($chunk);
            }
        }
        snapshotCheck($db, $tables);
        foreach ($tableNames as $table) {
            $columns = $db->getSchemaBuilder()->getColumns($table);
            foreach ($columns as $column) {
                if (! $column['auto_increment']) {
                    continue;
                }
                $qualifiedTable = $grammar->wrapTable($table);
                $name = $grammar->wrap($column['name']);
                $sequence = $db->selectOne('select pg_get_serial_sequence(?, ?) as name', [$qualifiedTable, $column['name']])->name;
                snapshotRequire($sequence !== null, "Missing sequence: {$table}");
                $db->select('select setval(?::regclass, coalesce(max('.$name.'), 1), max('.$name.') is not null) from '.$qualifiedTable, [$sequence]);
            }
        }
    });
    echo "Import committed. All rows verified; sequences aligned.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->transactionLevel() > 0) {
        $db->rollBack();
    }
    // QueryException includes SQL bindings and participant data; do not print it.
    $message = $error instanceof Illuminate\Database\QueryException ? 'Database operation failed; transaction rolled back. Inspect privately.' : $error->getMessage();
    fwrite(STDERR, $message."\n");
    exit(1);
}
