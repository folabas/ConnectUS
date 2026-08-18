import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../src/components/ui/card';
import React from 'react';

describe('Card Component', () => {
  it('should render card element', () => {
    render(<Card>Card content</Card>);
    expect(document.querySelector('.rounded-xl')).toBeInTheDocument();
  });

  it('should mark itself with the card slot', () => {
    // Asserting on the slot rather than on Tailwind utilities: the previous
    // assertion expected 'shadow-sm', which this component has never applied.
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveAttribute('data-slot', 'card');
    expect(container.firstChild).toHaveClass('border');
  });

  it('should merge a caller className', () => {
    const { container } = render(<Card className="custom-card">Content</Card>);
    expect(container.firstChild).toHaveClass('custom-card');
  });
});

describe('CardHeader Component', () => {
  it('should render card header', () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
  });
});

describe('CardTitle Component', () => {
  it('should render card title', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('should render the title as a heading', () => {
    const { container } = render(<CardTitle>Title</CardTitle>);
    expect(container.firstChild).toHaveAttribute('data-slot', 'card-title');
    expect((container.firstChild as HTMLElement).tagName).toBe('H4');
  });
});

describe('CardDescription Component', () => {
  it('should render card description', () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('should render with muted text color', () => {
    const { container } = render(<CardDescription>Description</CardDescription>);
    expect(container.firstChild).toHaveClass('text-muted-foreground');
  });
});

describe('CardContent Component', () => {
  it('should render card content', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('CardFooter Component', () => {
  it('should render card footer', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('should render with flex layout', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveClass('flex');
  });
});
