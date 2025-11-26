import { useEffect, useCallback } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// ============================================================================
// ONBOARDING TOUR
// Interactive guided tour using driver.js
// ============================================================================

// Tour step definitions for Classic Mode
const CLASSIC_TOUR_STEPS: DriveStep[] = [
    {
        element: '[data-tour="header"]',
        popover: {
            title: 'Welcome to Ambient Flow',
            description: 'This is your command center. Switch between modes, start recording, and control playback from here.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '[data-tour="play-button"]',
        popover: {
            title: 'Play/Pause',
            description: 'Click here or press <strong>Space</strong> to start the audio. The button glows when playing.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '[data-tour="volume"]',
        popover: {
            title: 'Master Volume',
            description: 'Control the overall volume. Drag the slider or click to adjust.',
            side: 'right',
            align: 'center',
        },
    },
    {
        element: '[data-tour="scene-selector"]',
        popover: {
            title: 'Sound Scenes',
            description: 'Choose from different ambient soundscapes. Each scene has its own unique character.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '[data-tour="xy-pad"]',
        popover: {
            title: 'XY Control Pad',
            description: 'Drag your finger or mouse to morph the sound in real-time. Enable <strong>Auto-Drift</strong> for autonomous movement.',
            side: 'right',
            align: 'center',
        },
    },
    {
        element: '[data-tour="mode-switch"]',
        popover: {
            title: 'Switch to Graph Mode',
            description: 'Ready for more power? Graph Mode lets you build your own audio patches with a node-based editor.',
            side: 'bottom',
            align: 'center',
        },
    },
];

// Tour step definitions for Graph Mode
const GRAPH_TOUR_STEPS: DriveStep[] = [
    {
        element: '[data-tour="graph-canvas"]',
        popover: {
            title: 'The Sound Graph',
            description: 'This is your audio workspace. Each box is a <strong>node</strong> that generates or processes sound.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        element: '[data-tour="node-palette"]',
        popover: {
            title: 'Node Palette',
            description: 'Drag nodes from here to add oscillators, effects, modulators, and more to your patch.',
            side: 'left',
            align: 'start',
        },
    },
    {
        element: '[data-tour="output-node"]',
        popover: {
            title: 'Master Output',
            description: 'All audio must connect to this node to be heard. It&apos;s your speaker.',
            side: 'left',
            align: 'center',
        },
    },
    {
        popover: {
            title: 'Making Connections',
            description: '<strong>Drag</strong> from an output handle (right side) to an input handle (left side) to connect nodes. Cyan wires = audio, Purple wires = modulation.',
            side: 'top',
            align: 'center',
        },
    },
    {
        element: '[data-tour="graph-play"]',
        popover: {
            title: 'Graph Playback',
            description: 'Press <strong>Space</strong> or click this button to start/stop the graph audio.',
            side: 'bottom',
            align: 'center',
        },
    },
    {
        popover: {
            title: 'Keyboard Shortcuts',
            description: 'Press <strong>?</strong> anytime to see all keyboard shortcuts. <strong>Delete</strong> removes selected nodes.',
            side: 'top',
            align: 'center',
        },
    },
];

interface OnboardingTourProps {
    /** Which tour to run */
    tourType: 'classic' | 'graph';
    /** Whether the tour should start */
    isActive: boolean;
    /** Callback when tour completes */
    onComplete: () => void;
    /** Callback when tour is skipped/dismissed */
    onSkip: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
    tourType,
    isActive,
    onComplete,
    onSkip,
}) => {
    const startTour = useCallback(() => {
        const steps = tourType === 'classic' ? CLASSIC_TOUR_STEPS : GRAPH_TOUR_STEPS;
        
        // Filter out steps with missing elements
        const validSteps = steps.filter(step => {
            if (!step.element) return true; // Non-element steps are always valid
            return document.querySelector(step.element);
        });

        if (validSteps.length === 0) {
            console.warn('[OnboardingTour] No valid tour steps found');
            onComplete();
            return;
        }

        const driverObj: Driver = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: 'rgba(0, 0, 0, 0.85)',
            stagePadding: 8,
            stageRadius: 12,
            popoverClass: 'ambient-flow-popover',
            progressText: '{{current}} of {{total}}',
            nextBtnText: 'Next →',
            prevBtnText: '← Back',
            doneBtnText: 'Done ✓',
            onDestroyStarted: () => {
                // User closed the tour early
                if (!driverObj.hasNextStep()) {
                    onComplete();
                } else {
                    onSkip();
                }
                driverObj.destroy();
            },
            steps: validSteps,
        });

        // Small delay to ensure DOM is ready
        requestAnimationFrame(() => {
            driverObj.drive();
        });
    }, [tourType, onComplete, onSkip]);

    // Start tour when active
    useEffect(() => {
        if (isActive) {
            // Delay to let any animations complete
            const timer = setTimeout(startTour, 500);
            return () => clearTimeout(timer);
        }
    }, [isActive, startTour]);

    return null; // This component doesn't render anything directly
};

// Custom CSS for driver.js popovers (injected as style tag)
export const OnboardingStyles = () => (
    <style>{`
        /* Custom driver.js popover styling */
        .driver-popover.ambient-flow-popover {
            background: rgba(17, 17, 17, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
                        0 0 30px rgba(0, 255, 136, 0.1);
            color: white;
            max-width: 320px;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-title {
            font-size: 1rem;
            font-weight: 600;
            color: white;
            padding: 0;
            margin-bottom: 0.5rem;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-description {
            font-size: 0.875rem;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.5;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-description strong {
            color: #00ff88;
            font-weight: 500;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-progress-text {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.4);
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-navigation-btns {
            gap: 0.5rem;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-prev-btn,
        .driver-popover.ambient-flow-popover .driver-popover-next-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-prev-btn:hover,
        .driver-popover.ambient-flow-popover .driver-popover-next-btn:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-next-btn {
            background: rgba(0, 255, 136, 0.2);
            border-color: rgba(0, 255, 136, 0.4);
            color: #00ff88;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-next-btn:hover {
            background: rgba(0, 255, 136, 0.3);
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-close-btn {
            color: rgba(255, 255, 255, 0.5);
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-close-btn:hover {
            color: white;
        }
        
        .driver-popover.ambient-flow-popover .driver-popover-arrow-side-left,
        .driver-popover.ambient-flow-popover .driver-popover-arrow-side-right,
        .driver-popover.ambient-flow-popover .driver-popover-arrow-side-top,
        .driver-popover.ambient-flow-popover .driver-popover-arrow-side-bottom {
            border-color: rgba(17, 17, 17, 0.95);
        }
    `}</style>
);

export default OnboardingTour;
