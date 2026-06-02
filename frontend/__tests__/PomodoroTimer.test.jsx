import { render, screen, fireEvent } from '@testing-library/react';
import PomodoroTimer from '@/components/common/PomodoroTimer';

test('renders focus mode by default', () => {
  render(<PomodoroTimer onClose={() => {}} />);
  expect(screen.getByText('25:00')).toBeInTheDocument();
});

test('calls onClose when X clicked', () => {
  const onClose = jest.fn();
  const { container } = render(<PomodoroTimer onClose={onClose} />);
  const closeBtn = container.querySelector('button.text-zinc-400');
  fireEvent.click(closeBtn);
  expect(onClose).toHaveBeenCalled();
});