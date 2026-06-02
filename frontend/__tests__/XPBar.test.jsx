import { render, screen } from '@testing-library/react';
import XPBar from '@/components/common/XPBar';

test('renders nothing when no xpData', () => {
  const { container } = render(<XPBar xpData={null} />);
  expect(container.firstChild).toBeNull();
});

test('renders level and xp', () => {
  render(<XPBar xpData={{ total: 750, level: 2 }} />);
  expect(screen.getByText(/Lv 2/)).toBeInTheDocument();
  expect(screen.getByText(/250\/500 XP/)).toBeInTheDocument();
});