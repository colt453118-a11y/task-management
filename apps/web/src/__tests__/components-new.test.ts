import { describe, it, expect } from 'vitest';

// ─── Component exports are verified by the typecheck pass ────
// These tests validate integration patterns and utility functions
// used by the new premium components. The Radix UI primitives
// themselves are thoroughly tested upstream.

describe('New Premium UI Components', () => {
  describe('Component exports exist', () => {
    it('Switch should be importable', async () => {
      const mod = await import('@/components/ui/switch');
      expect(mod.Switch).toBeDefined();
    });

    it('Progress should be importable', async () => {
      const mod = await import('@/components/ui/progress');
      expect(mod.Progress).toBeDefined();
    });

    it('Tabs should be importable', async () => {
      const mod = await import('@/components/ui/tabs');
      expect(mod.Tabs).toBeDefined();
      expect(mod.TabsList).toBeDefined();
      expect(mod.TabsTrigger).toBeDefined();
      expect(mod.TabsContent).toBeDefined();
    });

    it('Tooltip should be importable', async () => {
      const mod = await import('@/components/ui/tooltip');
      expect(mod.Tooltip).toBeDefined();
      expect(mod.TooltipProvider).toBeDefined();
      expect(mod.TooltipTrigger).toBeDefined();
      expect(mod.TooltipContent).toBeDefined();
    });

    it('Popover should be importable', async () => {
      const mod = await import('@/components/ui/popover');
      expect(mod.Popover).toBeDefined();
      expect(mod.PopoverTrigger).toBeDefined();
      expect(mod.PopoverContent).toBeDefined();
    });

    it('DropdownMenu should be importable', async () => {
      const mod = await import('@/components/ui/dropdown-menu');
      expect(mod.DropdownMenu).toBeDefined();
      expect(mod.DropdownMenuTrigger).toBeDefined();
      expect(mod.DropdownMenuContent).toBeDefined();
      expect(mod.DropdownMenuItem).toBeDefined();
      expect(mod.DropdownMenuSeparator).toBeDefined();
    });

    it('Checkbox should be importable', async () => {
      const mod = await import('@/components/ui/checkbox');
      expect(mod.Checkbox).toBeDefined();
    });

    it('Separator should be importable', async () => {
      const mod = await import('@/components/ui/separator');
      expect(mod.Separator).toBeDefined();
    });
  });

  describe('Component structural consistency', () => {
    it('Switch has displayName for devtools', async () => {
      const { Switch } = await import('@/components/ui/switch');
      expect(Switch.displayName).toBe('Switch');
    });

    it('Tabs sub-components have displayNames', async () => {
      const { TabsList, TabsTrigger, TabsContent } = await import('@/components/ui/tabs');
      expect(TabsList.displayName).toBe('TabsList');
      expect(TabsTrigger.displayName).toBe('TabsTrigger');
      expect(TabsContent.displayName).toBe('TabsContent');
    });

    it('Progress has displayName', async () => {
      const { Progress } = await import('@/components/ui/progress');
      expect(Progress.displayName).toBe('Progress');
    });

    it('Checkbox has displayName', async () => {
      const { Checkbox } = await import('@/components/ui/checkbox');
      expect(Checkbox.displayName).toBe('Checkbox');
    });

    it('Separator has displayName', async () => {
      const { Separator } = await import('@/components/ui/separator');
      expect(Separator.displayName).toBe('Separator');
    });

    it('Tooltip sub-components have displayNames', async () => {
      const { TooltipTrigger, TooltipContent } = await import('@/components/ui/tooltip');
      expect(TooltipTrigger.displayName).toBe('TooltipTrigger');
      expect(TooltipContent.displayName).toBe('TooltipContent');
    });

    it('Popover sub-components have displayNames', async () => {
      const { PopoverTrigger, PopoverContent } = await import('@/components/ui/popover');
      expect(PopoverTrigger.displayName).toBe('PopoverTrigger');
      expect(PopoverContent.displayName).toBe('PopoverContent');
    });
  });

  describe('Component API surface', () => {
    it('Button exports CVA variants', async () => {
      const { buttonVariants } = await import('@/components/ui/button');
      expect(buttonVariants).toBeDefined();
      expect(typeof buttonVariants).toBe('function');
    });

    it('Badge exports CVA variants', async () => {
      const { badgeVariants } = await import('@/components/ui/badge');
      expect(badgeVariants).toBeDefined();
      expect(typeof badgeVariants).toBe('function');
    });

    it('DropdownMenu exports all required sub-components', async () => {
      const mod = await import('@/components/ui/dropdown-menu');
      expect(mod.DropdownMenuGroup).toBeDefined();
      expect(mod.DropdownMenuPortal).toBeDefined();
      expect(mod.DropdownMenuLabel).toBeDefined();
    });
  });

  describe('Design system consistency', () => {
    it('All new components are properly exported', async () => {
      const SwitchMod = await import('@/components/ui/switch');
      const ProgressMod = await import('@/components/ui/progress');
      const CheckboxMod = await import('@/components/ui/checkbox');
      const SeparatorMod = await import('@/components/ui/separator');

      expect(SwitchMod.Switch).toBeDefined();
      expect(ProgressMod.Progress).toBeDefined();
      expect(CheckboxMod.Checkbox).toBeDefined();
      expect(SeparatorMod.Separator).toBeDefined();
    });

    it('cn utility is available and merges classes correctly', async () => {
      const { cn } = await import('@/lib/utils');
      expect(cn('base', 'extra')).toBe('base extra');
      expect(cn('base', false && 'hidden')).toBe('base');
      expect(cn('p-4', 'p-6')).toBe('p-6');
    });
  });
});
