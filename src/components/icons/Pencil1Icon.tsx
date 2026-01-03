import React from 'react';

interface Pencil1IconProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number;
    background?: string;
    opacity?: number;
    rotation?: number;
    shadow?: number;
    flipHorizontal?: boolean;
    flipVertical?: boolean;
    padding?: number;
}

const Pencil1Icon: React.FC<Pencil1IconProps> = ({
    size = 24,
    color = '#000000',
    strokeWidth = 2,
    background = 'transparent',
    opacity = 1,
    rotation = 0,
    shadow = 0,
    flipHorizontal = false,
    flipVertical = false,
    padding = 0
}) => {
    const transforms = [];
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
    if (flipHorizontal) transforms.push('scaleX(-1)');
    if (flipVertical) transforms.push('scaleY(-1)');

    const viewBoxSize = 15 + (padding * 2);
    const viewBoxOffset = -padding;
    const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={viewBox}
            width={size}
            height={size}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
                opacity,
                transform: transforms.join(' ') || undefined,
                filter: shadow > 0 ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : undefined,
                backgroundColor: background !== 'transparent' ? background : undefined
            }}
        >
            <path fill="currentColor" d="M11.225 1.082a.5.5 0 0 1 .629.064l2 2l.064.079a.5.5 0 0 1-.064.629l-7.432 7.431a1 1 0 0 1-.228.171l-.086.041l-3.41 1.463a.5.5 0 0 1-.658-.657l1.463-3.411l.04-.086q.07-.126.172-.228l7.432-7.432zM4.422 9.285L3.78 10.78l.438.438l1.497-.64L12.793 3.5L11.5 2.207z" />
        </svg>
    );
};

export default Pencil1Icon;
