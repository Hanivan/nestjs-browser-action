# Ghost Cursor

Human-like mouse movement for workflow `click` / `hover` via [ghost-cursor](https://github.com/Xetera/ghost-cursor), plus a `solveChallenge` action for Cloudflare Turnstile.

## Setup

Enable per workflow with `cursor: 'ghost'` (or `{ type: 'ghost', moveSpeed?, debug? }`). `debug: true` shows the cursor dot in headed runs.

Leave `cloak.humanize` **off** — both drive the mouse. A warning is logged if both are set.

Cursor is per page: on a `PageController`, successive workflows continue from the last mouse position.

## `offset`

`click` / `hover` accept `options.offset: { x: number | 'center', y: number | 'center' }` — a point relative to the element box's top-left. Requires `cursor`.

## `solveChallenge`

```ts
{ action: 'solveChallenge', id: 'cf', options: { timeout: 20000 } }
```

- Interstitial (`Just a moment...`): waits 5 s for auto-pass, else clicks the checkbox; pass = title changes.
- Checkbox location: pierces Cloudflare's cross-origin iframe (closed shadow roots) over CDP to find the real `Verify you are human` checkbox and ghost-clicks its center. Falls back to the +30px guess when the frame has not rendered or the browser lacks the CDP methods (e.g. Obscura has no `DOM.getFrameOwner`).
- Turnstile widget (`.cf-turnstile`, or a JS-rendered widget found by its `cf-chl-widget-*_response` input): waits 3 s, then ghost-clicks the checkbox if the token is still empty. Pass = token filled.
- `context[id]` = `'passed' | 'failed' | 'none'`. Never throws on failure.

## Example: CF interstitial (lkmn.link)

```ts
const result = await service.scrapeWithWorkflow('https://lkmn.link/', {
  version: '1.0',
  cursor: 'ghost',
  actions: [
    { action: 'solveChallenge', id: 'cf' },
    { action: 'evaluate', id: 'title', value: 'document.title' },
  ],
});
// result.data → { cf: 'passed', title: 'Home' }
```

## Example: checkboxes behind CF (qaautomationlabs)

```ts
const result = await service.scrapeWithWorkflow(
  'https://qaautomationlabs.com/testing/checkbox.php',
  {
    version: '1.0',
    cursor: 'ghost',
    actions: [
      { action: 'solveChallenge', id: 'cf' },
      { action: 'waitFor', target: { type: 'css', value: '#myCheckbox' } },
      { action: 'click', target: { type: 'css', value: '#myCheckbox' } },
      { action: 'click', target: { type: 'css', value: '#multichk1' } },
      { action: 'click', target: { type: 'css', value: '#multichk3' } },
      {
        action: 'evaluate',
        id: 'state',
        value: `() => ({
          single: document.querySelector('#myCheckbox').checked,
          message: document.querySelector('#message').textContent.trim(),
          multi: [...document.querySelectorAll('.myCheckbox')].map((c) => c.checked),
        })`,
      },
    ],
  },
);
// result.data.state → { single: true, message: 'checked', multi: [true, false, true, false] }
```

## Example: manual Turnstile widget click

What `solveChallenge` does for a widget, composed by hand:

```ts
actions: [
  { action: 'waitFor', target: { type: 'css', value: '.cf-turnstile' } },
  { action: 'wait', value: 3000 },
  {
    action: 'click',
    target: { type: 'css', value: '.cf-turnstile' },
    options: { offset: { x: 30, y: 'center' } },
  },
]
```
