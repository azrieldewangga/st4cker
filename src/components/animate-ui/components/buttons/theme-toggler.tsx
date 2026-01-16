'use client';

import * as React from 'react';
import { useStore } from '@/store/useStoreNew';

import { Monitor, Moon, Sun } from 'lucide-react';
import { VariantProps } from 'class-variance-authority';

import {
  ThemeToggler as ThemeTogglerPrimitive,
  type ThemeTogglerProps as ThemeTogglerPrimitiveProps,
  type ThemeSelection,
  type Resolved,
} from '@/components/animate-ui/primitives/effects/theme-toggler';
import { buttonVariants } from '@/components/animate-ui/components/buttons/icon';
import { cn } from '@/lib/utils';

// Helper to get resolved theme (Store Integration)
const useResolvedTheme = (theme: string) => {
  const [resolved, setResolved] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    if (theme !== 'system') {
      setResolved(theme as 'light' | 'dark');
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setResolved(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);

  return resolved;
};

const getIcon = (
  effective: ThemeSelection,
  resolved: Resolved,
  modes: ThemeSelection[],
) => {
  const theme = modes.includes('system') ? effective : resolved;
  return theme === 'system' ? (
    <Monitor />
  ) : theme === 'dark' ? (
    <Moon />
  ) : (
    <Sun />
  );
};

const getNextTheme = (
  effective: ThemeSelection,
  modes: ThemeSelection[],
): ThemeSelection => {
  const i = modes.indexOf(effective);
  if (i === -1) return modes[0];
  return modes[(i + 1) % modes.length];
};

type ThemeTogglerButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    modes?: ThemeSelection[];
    onImmediateChange?: ThemeTogglerPrimitiveProps['onImmediateChange'];
    direction?: ThemeTogglerPrimitiveProps['direction'];
  };

const ThemeTogglerButton = React.forwardRef<HTMLButtonElement, ThemeTogglerButtonProps>((
  {
    variant = 'ghost',
    size = 'default',
    modes = ['light', 'dark', 'system'],
    direction = 'ltr',
    onImmediateChange,
    onClick,
    className,
    ...props
  },
  ref
) => {
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);
  const resolvedTheme = useResolvedTheme(theme);

  return (
    <ThemeTogglerPrimitive
      theme={theme as ThemeSelection}
      resolvedTheme={resolvedTheme as Resolved}
      setTheme={setTheme}
      direction={direction}
      onImmediateChange={onImmediateChange}
    >
      {({ effective, resolved, toggleTheme }) => (
        <button
          ref={ref}
          data-slot="theme-toggler-button"
          className={cn(buttonVariants({ variant, size, className }))}
          onClick={(e) => {
            onClick?.(e);
            toggleTheme(getNextTheme(effective, modes));
          }}
          {...props}
        >
          {getIcon(effective, resolved, modes)}
        </button>
      )}
    </ThemeTogglerPrimitive>
  );
});

ThemeTogglerButton.displayName = 'ThemeTogglerButton';

export { ThemeTogglerButton, type ThemeTogglerButtonProps };
