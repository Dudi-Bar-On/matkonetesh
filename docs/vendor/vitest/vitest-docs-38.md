---
name: vitest-docs-38
description: "vitest (test runner) — vendor doc 38/48 (vitest.dev)"
type: reference
---

### Testing Complex Forms with Validation

```tsx
test('ContactForm handles complex validation scenarios', async () => {
  const mockSubmit = vi.fn()
  const { getByLabelText, getByText } = render(
    <ContactForm onSubmit={mockSubmit} />
  )

  const nameInput = page.getByLabelText(/full name/i)
  const emailInput = page.getByLabelText(/email/i)
  const messageInput = page.getByLabelText(/message/i)
  const submitButton = page.getByRole('button', { name: /send message/i })

  // Test validation triggers
  await submitButton.click()

  await expect.element(getByText('Name is required')).toBeInTheDocument()
  await expect.element(getByText('Email is required')).toBeInTheDocument()
  await expect.element(getByText('Message is required')).toBeInTheDocument()

  // Test partial validation
  await nameInput.fill('John Doe')
  await submitButton.click()

  await expect.element(getByText('Name is required')).not.toBeInTheDocument()
  await expect.element(getByText('Email is required')).toBeInTheDocument()

  // Test email format validation
  await emailInput.fill('invalid-email')
  await submitButton.click()

  await expect.element(getByText('Please enter a valid email')).toBeInTheDocument()

  // Test successful submission
  await emailInput.fill('john@example.com')
  await messageInput.fill('Hello, this is a test message.')
  await submitButton.click()

  expect(mockSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello, this is a test message.'
  })
})
```

### Testing Error Boundaries

```tsx
// Test how components handle and recover from errors
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Component error!')
  }
  return <div>Component working fine</div>
}

test('ErrorBoundary catches and displays errors gracefully', async () => {
  const { getByText, rerender } = render(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <ThrowError shouldThrow={false} />
    </ErrorBoundary>
  )

  // Initially working
  await expect.element(getByText('Component working fine')).toBeInTheDocument()

  // Trigger error
  rerender(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <ThrowError shouldThrow={true} />
    </ErrorBoundary>
  )

  // Error boundary should catch it
  await expect.element(getByText('Something went wrong')).toBeInTheDocument()
})
```

### Testing Accessibility

```tsx
test('Modal component is accessible', async () => {
  const { getByRole, getByLabelText } = render(
    <Modal isOpen={true} title="Settings">
      <SettingsForm />
    </Modal>
  )

  // Test focus management - modal should receive focus when opened
  // This is crucial for screen reader users to know a modal opened
  const modal = getByRole('dialog')
  await expect.element(modal).toHaveFocus()

  // Test ARIA attributes - these provide semantic information to screen readers
  await expect.element(modal).toHaveAttribute('aria-labelledby') // Links to title element
  await expect.element(modal).toHaveAttribute('aria-modal', 'true') // Indicates modal behavior

  // Test keyboard navigation - Escape key should close modal
  // This is required by ARIA authoring practices
  await userEvent.keyboard('{Escape}')
  // expect.element auto-retries until modal is removed
  await expect.element(modal).not.toBeInTheDocument()

  // Test focus trap - tab navigation should cycle within modal
  // This prevents users from tabbing to content behind the modal
  const firstInput = getByLabelText(/username/i)
  const lastButton = getByRole('button', { name: /save/i })

  // Use click to focus on the first input, then test tab navigation
  await firstInput.click()
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}') // Shift+Tab goes backwards
  await expect.element(lastButton).toHaveFocus() // Should wrap to last element
})
```

## Debugging Component Tests

### 1. Use Browser Dev Tools

Browser Mode runs tests in real browsers, giving you access to full developer tools. When tests fail, you can:

* **Open browser dev tools** during test execution (F12 or right-click → Inspect)
* **Set breakpoints** in your test code or component code
* **Inspect the DOM** to see the actual rendered output
* **Check console errors** for JavaScript errors or warnings
* **Monitor network requests** to debug API calls

For headful mode debugging, add `headless: false` to your browser config temporarily.

### 2. Add Debug Statements

Use strategic logging to understand test failures:

```tsx
test('debug form validation', async () => {
  render(<ContactForm />)

  const submitButton = page.getByRole('button', { name: /submit/i })
  await submitButton.click()

  // Debug: Check if element exists with different query
  const errorElement = page.getByText('Email is required')
  console.log('Error element found:', errorElement.length)

  await expect.element(errorElement).toBeInTheDocument()
})
```

### 3. Inspect Rendered Output

When components don't render as expected, investigate systematically:

**Use Vitest's browser UI:**

* Run tests with browser mode enabled
* Open the browser URL shown in the terminal to see tests running
* Visual inspection helps identify CSS issues, layout problems, or missing elements

**Test element queries:**

```tsx
// Debug why elements can't be found
const button = page.getByRole('button', { name: /submit/i })
console.log('Button count:', button.length) // Should be 1

// Try alternative queries if the first one fails
if (button.length === 0) {
  console.log('All buttons:', page.getByRole('button').length)
  console.log('By test ID:', page.getByTestId('submit-btn').length)
}
```

### 4. Verify Selectors

Selector issues are common causes of test failures. Debug them systematically:

**Check accessible names:**

```tsx
// If getByRole fails, check what roles/names are available
const buttons = page.getByRole('button').all()
for (const button of buttons) {
  // Use element() to get the DOM element and access native properties
  const element = button.element()
  const accessibleName = element.getAttribute('aria-label') || element.textContent
  console.log(`Button: "${accessibleName}"`)
}
```

**Test different query strategies:**

```tsx
// Multiple ways to find the same element using .or for auto-retrying
const submitButton = page.getByRole('button', { name: /submit/i }) // By accessible name
  .or(page.getByTestId('submit-button')) // By test ID
  .or(page.getByText('Submit')) // By exact text
// Note: Vitest doesn't have page.locator(), use specific getBy* methods instead
```

**Common selector debugging patterns:**

```tsx
test('debug element queries', async () => {
  render(<LoginForm />)

  // Check if element is visible and enabled
  const emailInput = page.getByLabelText(/email/i)
  await expect.element(emailInput).toBeVisible() // Will show if element is visible and print DOM if not
})
```

### 5. Debugging Async Issues

Component tests often involve timing issues:

```tsx
test('debug async component behavior', async () => {
  render(<AsyncUserProfile userId="123" />)

  // expect.element will automatically retry and show helpful error messages
  await expect.element(page.getByText('John Doe')).toBeInTheDocument()
})
```

## Migration from Other Testing Frameworks
