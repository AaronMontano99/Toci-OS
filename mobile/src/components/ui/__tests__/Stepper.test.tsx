import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { Stepper } from '@/components/ui/Stepper';
import { ThemeProvider } from '@/theme/ThemeContext';

function renderStepper(props: Partial<React.ComponentProps<typeof Stepper>> = {}) {
  const onChange = jest.fn();
  render(
    <ThemeProvider>
      <Stepper value={100} step={5} min={0} onChange={onChange} {...props} />
    </ThemeProvider>,
  );
  return { onChange };
}

describe('Stepper', () => {
  it('renders the current value', () => {
    renderStepper();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('nudges up by one step when the increment button is pressed', () => {
    const { onChange } = renderStepper();
    fireEvent.press(screen.getByTestId('stepper-increment'));
    expect(onChange).toHaveBeenCalledWith(105);
  });

  it('nudges down by one step when the decrement button is pressed', () => {
    const { onChange } = renderStepper();
    fireEvent.press(screen.getByTestId('stepper-decrement'));
    expect(onChange).toHaveBeenCalledWith(95);
  });

  it('clamps at the configured minimum', () => {
    const { onChange } = renderStepper({ value: 2, min: 0, step: 5 });
    fireEvent.press(screen.getByTestId('stepper-decrement'));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('switches to a text input when the value is tapped, and commits a typed number on submit', () => {
    const { onChange } = renderStepper();
    fireEvent.press(screen.getByTestId('stepper-value'));

    const input = screen.getByTestId('stepper-input');
    fireEvent.changeText(input, '225');
    fireEvent(input, 'submitEditing');

    expect(onChange).toHaveBeenCalledWith(225);
  });

  it('ignores an empty typed value instead of calling onChange with garbage', () => {
    const { onChange } = renderStepper();
    fireEvent.press(screen.getByTestId('stepper-value'));

    const input = screen.getByTestId('stepper-input');
    fireEvent.changeText(input, '');
    fireEvent(input, 'submitEditing');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('returns to the plain value display after committing a typed value', () => {
    renderStepper();
    fireEvent.press(screen.getByTestId('stepper-value'));
    fireEvent.changeText(screen.getByTestId('stepper-input'), '225');
    fireEvent(screen.getByTestId('stepper-input'), 'submitEditing');

    expect(screen.queryByTestId('stepper-input')).toBeNull();
  });
});
