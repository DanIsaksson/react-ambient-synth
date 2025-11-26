import React from 'react';

// ============================================================================
// SKIP LINKS
// Provides keyboard users with quick navigation to main content areas
// ============================================================================

interface SkipLinkProps {
    href: string;
    children: React.ReactNode;
}

const SkipLink: React.FC<SkipLinkProps> = ({ href, children }) => (
    <a
        href={href}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999]
                   focus:px-4 focus:py-2 focus:bg-green-500 focus:text-black focus:font-semibold
                   focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-300"
    >
        {children}
    </a>
);

export const SkipLinks: React.FC = () => {
    return (
        <div role="navigation" aria-label="Skip links">
            <SkipLink href="#main-content">Skip to main content</SkipLink>
            <SkipLink href="#audio-controls">Skip to audio controls</SkipLink>
        </div>
    );
};

export default SkipLinks;
