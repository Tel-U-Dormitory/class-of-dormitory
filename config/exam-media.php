<?php

return [
    // Enable only after the reverse proxy's internal location is mounted and tested.
    'accel_redirect' => env('EXAM_MEDIA_ACCEL_REDIRECT', false),
    'log_requests' => env('EXAM_MEDIA_LOG_REQUESTS', false),
];
