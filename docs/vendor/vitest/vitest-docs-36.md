---
name: vitest-docs-36
description: "vitest (test runner) — vendor doc 36/48 (vitest.dev)"
type: reference
---

## Playwright

[Playwright](https://playwright.dev) is a testing framework from Microsoft that excels at end-to-end testing across multiple browsers (Chromium, Firefox, and WebKit). It controls real browsers to test complete user workflows—from logging in and navigating your app to submitting forms and verifying results. Vitest, on the other hand, is optimised for fast, isolated unit and component tests in a headless environment. These differences make it an ideal complement to Vitest.

A standard setup is to use Vitest for all unit and component tests (business logic, utilities, hooks, and UI component tests), and Playwright for end-to-end tests that verify critical user paths and cross-browser compatibility. This combination gives you fast feedback during development with Vitest while ensuring your complete application works correctly in real browsers with Playwright.

Vitest recently introduced [browser mode](https://vitest.dev/guide/browser), which runs tests in real browsers. However, there are key architectural differences: Playwright component tests run in a Node.js process and control the browser remotely. Vitest's browser mode runs tests natively in the browser, maintaining consistency with Vitest's test runner and developer experience, but it does have some [limitations](https://vitest.dev/guide/browser/#limitations).

---

---
url: /guide/browser/component-testing.md
---

# Component Testing

Component testing is a testing strategy that focuses on testing individual UI components in isolation. Unlike end-to-end tests that test entire user flows, component tests verify that each component works correctly on its own, making them faster to run and easier to debug.

Vitest provides comprehensive support for component testing across multiple frameworks including Vue, React, Svelte, Lit, Preact, Qwik, Solid, Marko, and more. This guide covers the specific patterns, tools, and best practices for testing components effectively with Vitest.

## Why Component Testing?

Component testing sits between unit tests and end-to-end tests, offering several advantages:

* **Faster feedback** - Test individual components without loading entire applications
* **Isolated testing** - Focus on component behavior without external dependencies
* **Better debugging** - Easier to pinpoint issues in specific components
* **Comprehensive coverage** - Test edge cases and error states more easily

## Browser Mode for Component Testing

Component testing in Vitest uses **Browser Mode** to run tests in real browser environments using Playwright, WebdriverIO, or preview mode. This provides the most accurate testing environment as your components run in real browsers with actual DOM implementations, CSS rendering, and browser APIs.

### Why Browser Mode?

Browser Mode is the recommended approach for component testing because it provides the most accurate testing environment. Unlike DOM simulation libraries, Browser Mode catches real-world issues that can affect your users.

::: tip
Browser Mode catches issues that DOM simulation libraries might miss, including:

* CSS layout and styling problems
* Real browser API behavior
* Accurate event handling and propagation
* Proper focus management and accessibility features

:::

### Purpose of This Guide

This guide focuses specifically on **component testing patterns and best practices** using Vitest's capabilities. While many examples use Browser Mode (as it's the recommended approach), the focus here is on component-specific testing strategies rather than browser configuration details.

For detailed browser setup, configuration options, and advanced browser features, refer to the [Browser Mode documentation](/guide/browser/).

## What Makes a Good Component Test

Good component tests focus on **behavior and user experience** rather than implementation details:

* **Test the contract** - How components receive inputs (props) and produce outputs (events, renders)
* **Test user interactions** - Clicks, form submissions, keyboard navigation
* **Test edge cases** - Error states, loading states, empty states
* **Avoid testing internals** - State variables, private methods, CSS classes

### Component Testing Hierarchy

```
1. Critical User Paths → Always test these
2. Error Handling      → Test failure scenarios
3. Edge Cases          → Empty data, extreme values
4. Accessibility       → Screen readers, keyboard nav
5. Performance         → Large datasets, animations
```

## Component Testing Strategies

### Isolation Strategy

Test components in isolation by mocking dependencies:

```tsx
// For API requests, we recommend MSW (Mock Service Worker)
// See: https://vitest.dev/guide/mocking/requests
//
// vi.mock(import('../api/userService'), () => ({
//   fetchUser: vi.fn().mockResolvedValue({ name: 'John' })
// }))

// Mock child components to focus on parent logic
vi.mock(import('../components/UserCard'), () => ({
  default: vi.fn(({ user }) => `<div>User: ${user.name}</div>`)
}))

test('UserProfile handles loading and data states', async () => {
  const { getByText } = render(<UserProfile userId="123" />)

  // Test loading state
  await expect.element(getByText('Loading...')).toBeInTheDocument()

  // Test for data to load (expect.element auto-retries)
  await expect.element(getByText('User: John')).toBeInTheDocument()
})
```

### Integration Strategy

Test component collaboration and data flow:

```tsx
test('ProductList filters and displays products correctly', async () => {
  const mockProducts = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 999 },
    { id: 2, name: 'Book', category: 'Education', price: 29 }
  ]

  const { getByLabelText, getByText } = render(
    <ProductList products={mockProducts} />
  )

  // Initially shows all products
  await expect.element(getByText('Laptop')).toBeInTheDocument()
  await expect.element(getByText('Book')).toBeInTheDocument()

  // Filter by category
  await userEvent.selectOptions(
    getByLabelText(/category/i),
    'Electronics'
  )

  // Only electronics should remain
  await expect.element(getByText('Laptop')).toBeInTheDocument()
  await expect.element(queryByText('Book')).not.toBeInTheDocument()
})
```

## Testing Library Integration

While Vitest provides official packages for popular frameworks ([`vitest-browser-vue`](https://npmx.dev/package/vitest-browser-vue), [`vitest-browser-react`](https://npmx.dev/package/vitest-browser-react), [`vitest-browser-svelte`](https://npmx.dev/package/vitest-browser-svelte)), you can integrate with [Testing Library](https://testing-library.com/) for frameworks not yet officially supported.

### When to Use Testing Library

* Your framework doesn't have an official Vitest browser package yet
* You're migrating existing tests that use Testing Library
* You prefer Testing Library's API for specific testing scenarios
