import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, buttonVariants } from '../../src/components/ui/button';
import React from 'react';

describe('Button Component', () => {
  it('should render with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('should render with different variants', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;

    variants.forEach((variant) => {
      const { container } = render(<Button variant={variant}>Test</Button>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('should render with different sizes', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const;

    sizes.forEach((size) => {
      const { container } = render(<Button size={size}>Test</Button>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should render as child when asChild is true', () => {
    render(
      <Button asChild>
        <span>Child Element</span>
      </Button>
    );
    expect(screen.getByText('Child Element')).toBeInTheDocument();
  });
});

describe('buttonVariants', () => {
  it('should return default variants', () => {
    const variant = buttonVariants({ variant: 'default' });
    expect(variant).toContain('bg-primary');
  });

  it('should return destructive variants', () => {
    const variant = buttonVariants({ variant: 'destructive' });
    expect(variant).toContain('bg-destructive');
  });

  it('should return outline variants', () => {
    const variant = buttonVariants({ variant: 'outline' });
    expect(variant).toContain('border');
  });

  it('should return secondary variants', () => {
    const variant = buttonVariants({ variant: 'secondary' });
    expect(variant).toContain('bg-secondary');
  });

  it('should return ghost variants', () => {
    const variant = buttonVariants({ variant: 'ghost' });
    expect(variant).toContain('hover:bg-accent');
  });

  it('should return link variants', () => {
    const variant = buttonVariants({ variant: 'link' });
    expect(variant).toContain('text-primary');
  });

  it('should return default size', () => {
    const variant = buttonVariants({ size: 'default' });
    expect(variant).toContain('h-9');
  });

  it('should return sm size', () => {
    const variant = buttonVariants({ size: 'sm' });
    expect(variant).toContain('h-8');
  });

  it('should return lg size', () => {
    const variant = buttonVariants({ size: 'lg' });
    expect(variant).toContain('h-10');
  });

  it('should return icon size', () => {
    const variant = buttonVariants({ size: 'icon' });
    expect(variant).toContain('size-9');
  });
});
