import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/**
 * Smoke test - verifies the Vitest + RTL + jsdom pipeline is wired up.
 * Real route tests land alongside each migrated route module.
 */
describe('vitest pipeline', () => {
  it('renders a plain DOM node', () => {
    render(<div>shell-smoke</div>);
    expect(screen.getByText('shell-smoke')).toBeInTheDocument();
  });
});
