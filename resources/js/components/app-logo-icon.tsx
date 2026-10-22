import { SVGAttributes } from 'react';

/** Permata merah dari logo CoD, dipakai sebagai ikon ringkas. */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 1.5 21 10.5 12 22.5 3 10.5Z" fill="currentColor" opacity="0.85" />
            <path d="M12 1.5 15.5 10.5 12 22.5 8.5 10.5Z" fill="currentColor" />
            <path d="M3 10.5h18" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
        </svg>
    );
}
