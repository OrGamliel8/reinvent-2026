import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePlanner } from './PlannerProvider';
import { applyTheme, storedTheme, watchSystemTheme, type Theme } from './theme';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

type ThemeContextValue = [Theme, (theme: Theme) => void];

const ThemeContext = createContext<ThemeContextValue | null>(null);

// The User Store is the source of truth; localStorage only mirrors it to avoid a flash on load.
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const { api, mutate } = usePlanner();
  const [theme, setThemeState] = useState<Theme>(storedTheme);

  useEffect(() => {
    void api.settings().then((settings) => {
      setThemeState(settings.theme);
      applyTheme(settings.theme);
    });
  }, [api]);

  useEffect(() => (theme === 'system' ? watchSystemTheme() : undefined), [theme]);

  const setTheme = (next: Theme): void => {
    setThemeState(next);
    applyTheme(next);
    void mutate(async (planner) => planner.updateSettings({ ...(await planner.settings()), theme: next }));
  };
  return <ThemeContext.Provider value={[theme, setTheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function ThemeToggle(): ReactNode {
  const [theme, setTheme] = useTheme();
  const Icon = ICONS[theme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
