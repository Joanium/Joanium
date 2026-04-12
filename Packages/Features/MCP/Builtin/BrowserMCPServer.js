import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { getBrowserPreviewService } from '../../../Main/Services/BrowserPreviewService.js';
const BROWSER_TOOLS = [
    {
      name: 'browser_navigate',
      description: 'Open a URL in the built-in browser session.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'The absolute URL to open.' } },
        required: ['url'],
      },
    },
    {
      name: 'browser_snapshot',
      description:
        'Read the current page and list visible interactive elements with stable ids like ow-1.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_click',
      description:
        'Click a visible element by stable id from browser_snapshot, CSS selector, or visible label text.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_hover',
      description: 'Hover a visible element by stable id, CSS selector, or visible label text.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_focus',
      description:
        'Focus or activate an element by stable id, CSS selector, or visible label text.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, visible label text, or "focused".',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_type',
      description:
        'Type text into an input, combobox, contenteditable region, or textarea by stable id, selector, or label.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, visible label text, or "focused".',
          },
          text: { type: 'string', description: 'The text to type into the field.' },
          clearFirst: {
            type: 'boolean',
            description: 'Clear the field before typing. Defaults to true.',
          },
          pressEnter: { type: 'boolean', description: 'Press Enter after typing.' },
        },
        required: ['target', 'text'],
      },
    },
    {
      name: 'browser_clear',
      description:
        'Clear the current value of a text field by stable id, selector, label, or "focused".',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, visible label text, or "focused".',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_press_key',
      description:
        'Send a keyboard key such as Enter, Tab, ArrowDown, or Escape to the focused element or a target.',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Keyboard key to press, such as Enter, Tab, Escape, ArrowDown, or A.',
          },
          target: {
            type: 'string',
            description: 'Optional stable id, selector, or label to focus before pressing the key.',
          },
        },
        required: ['key'],
      },
    },
    {
      name: 'browser_select_option',
      description: 'Select an option in a select element by value or visible label.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the select element.',
          },
          value: { type: 'string', description: 'Option value or visible option text to select.' },
        },
        required: ['target', 'value'],
      },
    },
    {
      name: 'browser_scroll',
      description: 'Scroll the page or a specific element.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            description: 'up, down, left, right, top, or bottom. Defaults to down.',
          },
          amount: {
            type: 'number',
            description: 'Pixels to scroll when using up, down, left, or right. Defaults to 600.',
          },
          target: {
            type: 'string',
            description: 'Optional stable id, selector, or label for a scrollable element.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_wait',
      description:
        'Wait for a fixed amount of time to allow dynamic page updates or animations to finish.',
      inputSchema: {
        type: 'object',
        properties: {
          timeoutMs: { type: 'number', description: 'How long to wait. Defaults to 1000ms.' },
        },
        required: [],
      },
    },
    {
      name: 'browser_set_checked',
      description: 'Set a checkbox, radio button, or switch-like control to checked or unchecked.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the control.',
          },
          checked: { type: 'boolean', description: 'Whether the control should be checked.' },
        },
        required: ['target', 'checked'],
      },
    },
    {
      name: 'browser_list_options',
      description: 'List the available options for a select, combobox, or listbox-like control.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the control.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_list_links',
      description:
        'List visible links and button-like actions on the current page with stable ids.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_find_elements',
      description:
        'Find visible interactive elements whose label, text, role, id, or selector matches a query.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text, label, stable id, or CSS selector to search for.',
          },
          limit: { type: 'number', description: 'Maximum matches to return. Defaults to 10.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'browser_list_form_fields',
      description:
        'List visible form fields, labels, current values, and states on the page or within a target area.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Optional stable id, selector, or label for a form or section to inspect.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_scroll_into_view',
      description: 'Scroll a visible element into the center of the built-in browser viewport.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_submit_form',
      description:
        'Submit a form from a target field or button, or from the currently focused element.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description:
              'Optional stable id, CSS selector, or visible label text for the form field or submit button.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_wait_for_element',
      description:
        'Wait until an element is visible on the page by stable id, selector, or label text.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
          timeoutMs: {
            type: 'number',
            description: 'How long to wait before failing. Defaults to 15000.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_read_element',
      description:
        'Read the label, text, value, and state of a visible element by stable id, selector, or label text.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_wait_for_text',
      description: 'Wait until specific text appears anywhere on the current page.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to wait for on the page.' },
          timeoutMs: {
            type: 'number',
            description: 'How long to wait before failing. Defaults to 15000.',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'browser_wait_for_navigation',
      description: 'Wait for the current page to finish navigating or loading.',
      inputSchema: {
        type: 'object',
        properties: {
          timeoutMs: {
            type: 'number',
            description: 'How long to wait before failing. Defaults to 15000.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_screenshot',
      description: 'Capture the current browser view to a PNG file in the temp folder.',
      inputSchema: {
        type: 'object',
        properties: { fileName: { type: 'string', description: 'Optional PNG file name.' } },
        required: [],
      },
    },
    {
      name: 'browser_get_state',
      description: 'Get the current page URL, title, loading state, and a short text excerpt.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_back',
      description: 'Go back to the previous page in the built-in browser session.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_forward',
      description: 'Go forward to the next page in the built-in browser session.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_refresh',
      description: 'Reload the current page in the built-in browser session.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_double_click',
      description:
        'Double-click a visible element by stable id, CSS selector, or visible label text.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_right_click',
      description:
        'Right-click (context-menu click) a visible element by stable id, CSS selector, or visible label text.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_drag_and_drop',
      description: 'Drag a source element and drop it onto a target element using pointer events.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Stable id, CSS selector, or label of the element to drag.',
          },
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or label of the drop destination element.',
          },
        },
        required: ['source', 'target'],
      },
    },
    {
      name: 'browser_click_at',
      description: 'Click at an exact x, y coordinate position in the browser viewport.',
      inputSchema: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'Horizontal pixel position from the left edge of the viewport.',
          },
          y: {
            type: 'number',
            description: 'Vertical pixel position from the top edge of the viewport.',
          },
        },
        required: ['x', 'y'],
      },
    },
    {
      name: 'browser_get_text',
      description: 'Get the visible text content of an element or the entire page body.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Optional stable id, CSS selector, or label. Omit to get all page text.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_get_html',
      description: 'Get the inner HTML of a specific element or the full page HTML.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Optional stable id, CSS selector, or label. Omit to get full page HTML.',
          },
          outer: {
            type: 'boolean',
            description:
              'If true, return outerHTML (includes the element tag itself). Defaults to false (innerHTML).',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_get_attribute',
      description: 'Get the value of a specific HTML attribute from an element.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
          attribute: {
            type: 'string',
            description: 'The attribute name to read, e.g. "href", "src", "data-id".',
          },
        },
        required: ['target', 'attribute'],
      },
    },
    {
      name: 'browser_set_attribute',
      description: 'Set an HTML attribute on an element to a given value.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
          attribute: { type: 'string', description: 'The attribute name to set.' },
          value: { type: 'string', description: 'The value to assign to the attribute.' },
        },
        required: ['target', 'attribute', 'value'],
      },
    },
    {
      name: 'browser_remove_attribute',
      description: 'Remove an HTML attribute from an element.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
          attribute: { type: 'string', description: 'The attribute name to remove.' },
        },
        required: ['target', 'attribute'],
      },
    },
    {
      name: 'browser_get_computed_style',
      description: 'Get the computed CSS value of a specific property for an element.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
          property: {
            type: 'string',
            description: 'CSS property name, e.g. "color", "font-size", "display".',
          },
        },
        required: ['target', 'property'],
      },
    },
    {
      name: 'browser_get_element_bounds',
      description:
        'Get the bounding rectangle (x, y, width, height, top, right, bottom, left) of an element.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or visible label text for the element.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_count_elements',
      description: 'Count how many elements on the page match a CSS selector or label query.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector to match and count.' },
          visibleOnly: {
            type: 'boolean',
            description: 'If true, only count visible elements. Defaults to false.',
          },
        },
        required: ['selector'],
      },
    },
    {
      name: 'browser_extract_table',
      description:
        'Extract all rows and columns from an HTML table and return them as a JSON array of objects.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description:
              'Optional CSS selector or label for a specific table. Defaults to the first table on the page.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_get_images',
      description: 'List all images on the current page with their src, alt text, and dimensions.',
      inputSchema: {
        type: 'object',
        properties: {
          visibleOnly: {
            type: 'boolean',
            description:
              'If true, only return images that are currently visible in the viewport. Defaults to false.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_get_all_links',
      description:
        'Get every hyperlink on the page including href, visible text, and whether it opens in a new tab.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description:
              'Optional substring filter — only return links whose href or text contains this string.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_get_page_source',
      description: 'Get the full raw HTML source of the current page as a string.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_get_viewport_size',
      description: 'Get the current width and height of the browser viewport in pixels.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_set_viewport_size',
      description: 'Resize the browser window to a specific width and height.',
      inputSchema: {
        type: 'object',
        properties: {
          width: { type: 'number', description: 'Desired viewport width in pixels.' },
          height: { type: 'number', description: 'Desired viewport height in pixels.' },
        },
        required: ['width', 'height'],
      },
    },
    {
      name: 'browser_set_zoom',
      description: 'Set the zoom level of the current page. 1.0 is 100%, 1.5 is 150%, 0.5 is 50%.',
      inputSchema: {
        type: 'object',
        properties: {
          factor: {
            type: 'number',
            description: 'Zoom factor. 1.0 = normal, 1.5 = zoomed in, 0.5 = zoomed out.',
          },
        },
        required: ['factor'],
      },
    },
    {
      name: 'browser_get_meta_tags',
      description:
        'Get all meta tags from the page head including name, property, content, and charset attributes.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_execute_script',
      description:
        'Execute arbitrary JavaScript in the page context and return the result. Use for custom automation logic.',
      inputSchema: {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description:
              'JavaScript code to execute. Can return a value via a return statement or an IIFE.',
          },
        },
        required: ['script'],
      },
    },
    {
      name: 'browser_inject_css',
      description:
        'Inject a CSS stylesheet string into the current page. Returns an injection key that can be used to remove it.',
      inputSchema: {
        type: 'object',
        properties: {
          css: {
            type: 'string',
            description: 'CSS rules to inject into the page, e.g. "body { background: red; }".',
          },
        },
        required: ['css'],
      },
    },
    {
      name: 'browser_highlight_element',
      description:
        'Visually highlight an element with a colored outline to identify it on the page. Useful for debugging.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description:
              'Stable id, CSS selector, or visible label text for the element to highlight.',
          },
          color: {
            type: 'string',
            description: 'Outline color. Defaults to "red". Accepts any CSS color value.',
          },
          durationMs: {
            type: 'number',
            description:
              'How long to show the highlight in ms. Defaults to 3000. Use 0 to keep indefinitely.',
          },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_remove_highlights',
      description: 'Remove all highlight outlines previously added by browser_highlight_element.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_get_cookies',
      description: 'List all cookies for the current page URL, or optionally filter by name.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Optional cookie name to filter by.' } },
        required: [],
      },
    },
    {
      name: 'browser_set_cookie',
      description: 'Set a cookie for the current page session.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Cookie name.' },
          value: { type: 'string', description: 'Cookie value.' },
          domain: {
            type: 'string',
            description: 'Optional domain. Defaults to the current page domain.',
          },
          path: { type: 'string', description: 'Optional path. Defaults to "/".' },
          secure: {
            type: 'boolean',
            description: 'Whether the cookie is secure. Defaults to false.',
          },
          httpOnly: {
            type: 'boolean',
            description: 'Whether the cookie is HTTP-only. Defaults to false.',
          },
          expirationDate: {
            type: 'number',
            description: 'Optional Unix timestamp for cookie expiry.',
          },
        },
        required: ['name', 'value'],
      },
    },
    {
      name: 'browser_delete_cookie',
      description: 'Delete a specific cookie by name from the current page URL.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the cookie to delete.' },
          url: {
            type: 'string',
            description: 'Optional URL the cookie belongs to. Defaults to the current page URL.',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'browser_clear_cookies',
      description: 'Clear all cookies for the current page URL.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_get_local_storage',
      description: 'Get one or all localStorage items for the current page origin.',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Specific key to retrieve. Omit to get all key-value pairs.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_set_local_storage',
      description: 'Set a localStorage key-value pair for the current page origin.',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The localStorage key.' },
          value: { type: 'string', description: 'The value to store (must be a string).' },
        },
        required: ['key', 'value'],
      },
    },
    {
      name: 'browser_remove_local_storage',
      description: 'Remove a specific key from localStorage for the current page origin.',
      inputSchema: {
        type: 'object',
        properties: { key: { type: 'string', description: 'The localStorage key to remove.' } },
        required: ['key'],
      },
    },
    {
      name: 'browser_clear_local_storage',
      description: 'Clear all localStorage data for the current page origin.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_get_session_storage',
      description: 'Get one or all sessionStorage items for the current page origin.',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Specific key to retrieve. Omit to get all key-value pairs.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_set_session_storage',
      description: 'Set a sessionStorage key-value pair for the current page origin.',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The sessionStorage key.' },
          value: { type: 'string', description: 'The value to store (must be a string).' },
        },
        required: ['key', 'value'],
      },
    },
    {
      name: 'browser_clear_session_storage',
      description: 'Clear all sessionStorage data for the current page origin.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_check_element_exists',
      description:
        'Check whether an element exists in the DOM (visible or not). Returns true or false.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'CSS selector or stable id to check for.' },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_check_element_visible',
      description:
        'Check whether an element exists AND is visible in the page. Returns true or false.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'CSS selector, stable id, or label to check.' },
        },
        required: ['target'],
      },
    },
    {
      name: 'browser_check_text_present',
      description:
        'Check whether specific text appears anywhere on the current page. Returns true or false.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text string to search for (case-insensitive).' },
        },
        required: ['text'],
      },
    },
    {
      name: 'browser_assert_url_contains',
      description:
        'Assert the current URL contains a given substring. Throws an error if it does not match.',
      inputSchema: {
        type: 'object',
        properties: {
          substring: {
            type: 'string',
            description: 'Expected substring that the current URL must contain.',
          },
        },
        required: ['substring'],
      },
    },
    {
      name: 'browser_assert_title_contains',
      description:
        'Assert the current page title contains a given substring. Throws an error if it does not match.',
      inputSchema: {
        type: 'object',
        properties: {
          substring: {
            type: 'string',
            description: 'Expected substring that the page title must contain.',
          },
        },
        required: ['substring'],
      },
    },
    {
      name: 'browser_override_dialogs',
      description:
        'Inject a script that intercepts window.alert, window.confirm, and window.prompt so they do not block the page. Must be called after navigation or page load to take effect.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_set_dialog_response',
      description:
        'Configure how the next intercepted dialog (alert/confirm/prompt) will be handled. Call browser_override_dialogs first.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: '"accept" to confirm/OK the dialog, or "dismiss" to cancel it.',
          },
          promptText: {
            type: 'string',
            description: 'For prompt dialogs, the text to return as the user input.',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'browser_get_last_dialog',
      description:
        'Get information about the most recently intercepted dialog (type, message, result). Requires browser_override_dialogs to have been called.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_get_performance_metrics',
      description:
        'Get page load timing metrics including DNS lookup, TCP connection, TTFB, DOM load, and total load time.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_get_console_logs',
      description:
        'Get console messages (log, warn, error, info) that have been captured since the browser session started or since the last clear.',
      inputSchema: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            description:
              'Optional filter: "log", "warn", "error", or "info". Omit to get all levels.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of recent log entries to return. Defaults to 50.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_clear_console_logs',
      description: 'Clear all captured console log entries from the internal buffer.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'browser_get_form_data',
      description:
        'Extract all form field names and their current values from the page or a specific form as a JSON object.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description:
              'Optional CSS selector or label to identify a specific form. Defaults to the first form found.',
          },
        },
        required: [],
      },
    },
    {
      name: 'browser_fill_form',
      description:
        'Fill multiple form fields at once using a JSON map of label/name -> value pairs.',
      inputSchema: {
        type: 'object',
        properties: {
          fields: {
            type: 'object',
            description:
              'A JSON object where each key is a field label, name, or stable id and each value is the text to type.',
            additionalProperties: { type: 'string' },
          },
          submit: {
            type: 'boolean',
            description: 'If true, submit the form after filling all fields. Defaults to false.',
          },
        },
        required: ['fields'],
      },
    },
    {
      name: 'browser_upload_file',
      description:
        'Set a file on a file input element using a local file path. Uses the Chrome DevTools Protocol for reliable file injection.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Stable id, CSS selector, or label of the file input element.',
          },
          filePath: { type: 'string', description: 'Absolute path to the local file to upload.' },
        },
        required: ['target', 'filePath'],
      },
    },
    {
      name: 'browser_get_selection',
      description: 'Get the currently selected (highlighted) text on the page.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
  ],
  PAGE_HELPERS = String.raw`
  const normalizeText = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const isVisible = el => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const getNodeText = el => normalizeText(
    el?.innerText ||
    el?.textContent ||
    el?.value ||
    el?.placeholder ||
    el?.getAttribute?.('aria-label') ||
    el?.getAttribute?.('title') ||
    el?.name ||
    el?.id
  );
  const getElementLabel = el => {
    const labels = [];
    if (Array.isArray(el?.labels)) labels.push(...el.labels.map(label => getNodeText(label)));
    if (el?.id) {
      document.querySelectorAll('label[for="' + CSS.escape(el.id) + '"]').forEach(label => labels.push(getNodeText(label)));
    }
    labels.push(getNodeText(el));
    return normalizeText(labels.filter(Boolean).join(' | '));
  };
  const isTextLike = el => {
    if (!el) return false;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) {
      const type = String(el.type || 'text').toLowerCase();
      return !['checkbox', 'radio', 'file', 'range', 'color', 'submit', 'reset', 'button', 'image', 'hidden'].includes(type);
    }
    if (el instanceof HTMLSelectElement) return false;
    if (el.isContentEditable) return true;
    const role = String(el.getAttribute?.('role') || '').toLowerCase();
    return role === 'textbox' || role === 'combobox' || role === 'searchbox';
  };
  const interactiveSelectors = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="searchbox"]',
    '[contenteditable="true"]',
    'label',
  ];
  const formFieldSelector = 'input:not([type="hidden"]), textarea, select, [role="textbox"], [role="combobox"], [role="searchbox"], [contenteditable="true"]';
  const isFormField = el => {
    if (!el) return false;
    try {
      return el.matches(formFieldSelector) || isTextLike(el);
    } catch {
      return isTextLike(el);
    }
  };
  const collectVisibleFields = root => {
    const scope = root?.querySelectorAll ? root : document;
    const direct = root instanceof Element && isFormField(root) ? [root] : [];
    return [...direct, ...scope.querySelectorAll(formFieldSelector)]
      .map(el => el.tagName === 'LABEL' && el.control ? el.control : el)
      .filter(el => el && isVisible(el))
      .filter((el, index, arr) => arr.indexOf(el) === index)
      .slice(0, 120);
  };
  const findInteractiveDescendant = (el, preferTextField = false) => {
    if (!el) return null;
    if (el.tagName === 'LABEL' && el.control) return el.control;
    if (preferTextField && isTextLike(el)) return el;
    if (!preferTextField && interactiveSelectors.some(selector => {
      try { return el.matches(selector); }
      catch { return false; }
    })) return el;

    const selector = preferTextField
      ? 'input:not([type="hidden"]), textarea, [role="textbox"], [role="combobox"], [role="searchbox"], [contenteditable="true"]'
      : interactiveSelectors.join(',');

    const candidate = [...el.querySelectorAll(selector)].find(isVisible);
    if (!candidate) return null;
    return candidate.tagName === 'LABEL' && candidate.control ? candidate.control : candidate;
  };
  const findNearbyTextField = el => {
    if (!el) return null;
    if (isTextLike(el)) return el;
    if (el.tagName === 'LABEL' && el.control && isTextLike(el.control)) return el.control;

    const localMatch = findInteractiveDescendant(el, true);
    if (localMatch && isTextLike(localMatch)) return localMatch;

    const ariaControls = el.getAttribute?.('aria-controls');
    if (ariaControls) {
      const controlled = document.getElementById(ariaControls);
      const controlledField = findInteractiveDescendant(controlled, true);
      if (controlledField && isTextLike(controlledField)) return controlledField;
    }

    const containers = [
      el.closest?.('label'),
      el.closest?.('[role="group"]'),
      el.closest?.('[role="dialog"]'),
      el.closest?.('[data-testid]'),
      el.parentElement,
      el.parentElement?.parentElement,
    ].filter(Boolean);

    for (const container of containers) {
      const field = findInteractiveDescendant(container, true);
      if (field && isTextLike(field)) return field;
    }

    return null;
  };
  const assignStableIds = () => {
    const elements = [...document.querySelectorAll(interactiveSelectors.join(','))]
      .map(el => el.tagName === 'LABEL' && el.control ? el.control : el)
      .filter(el => el && isVisible(el))
      .filter((el, index, arr) => arr.indexOf(el) === index)
      .slice(0, 180);

    elements.forEach((el, index) => {
      if (!el.dataset.owMcpId) el.dataset.owMcpId = 'ow-' + String(index + 1);
    });

    return elements;
  };
  const describeElement = el => ({
    tag: (el?.tagName || '').toLowerCase(),
    type: normalizeText(el?.getAttribute?.('type')),
    role: normalizeText(el?.getAttribute?.('role')),
    label: getElementLabel(el),
    id: el?.dataset?.owMcpId || '',
  });
  const resolveTarget = (rawTarget, options = {}) => {
    const preferTextField = Boolean(options.preferTextField);
    const allowFocused = options.allowFocused !== false;
    const target = normalizeText(rawTarget);
    if (!target) return null;

    if (allowFocused && target.toLowerCase() === 'focused') {
      const focused = document.activeElement || null;
      return preferTextField ? (findNearbyTextField(focused) || focused) : focused;
    }

    if (target.startsWith('ow-')) {
      const byId = document.querySelector('[data-ow-mcp-id="' + CSS.escape(target) + '"]');
      if (byId) return (preferTextField ? findNearbyTextField(byId) : findInteractiveDescendant(byId, preferTextField)) || byId;
    }

    try {
      const bySelector = document.querySelector(target);
      if (bySelector) return (preferTextField ? findNearbyTextField(bySelector) : findInteractiveDescendant(bySelector, preferTextField)) || bySelector;
    } catch { /* ignore invalid selectors */ }

    const lowered = target.toLowerCase();
    const candidates = assignStableIds();

    const byText = candidates.find(candidate => {
      const values = [
        candidate.dataset.owMcpId,
        getElementLabel(candidate),
        candidate.placeholder,
        candidate.getAttribute?.('aria-label'),
        candidate.getAttribute?.('title'),
        candidate.name,
        candidate.id,
      ]
        .map(value => normalizeText(value).toLowerCase())
        .filter(Boolean);

      return values.some(value => value === lowered || value.includes(lowered));
    });

    if (!byText) return null;
    return (preferTextField ? findNearbyTextField(byText) : findInteractiveDescendant(byText, preferTextField)) || byText;
  };
  const focusElement = el => {
    if (!el) return;
    el.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'instant' });
    el.focus?.({ preventScroll: true });
  };
  const setElementValue = (el, nextValue) => {
    if (el instanceof HTMLInputElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set ? descriptor.set.call(el, nextValue) : (el.value = nextValue);
    } else if (el instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      descriptor?.set ? descriptor.set.call(el, nextValue) : (el.value = nextValue);
    } else if (el.isContentEditable) {
      el.textContent = nextValue;
    } else {
      el.value = nextValue;
    }

    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: nextValue, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const dispatchKeyboard = (el, key) => {
    ['keydown', 'keypress', 'keyup'].forEach(type => {
      el.dispatchEvent(new KeyboardEvent(type, {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      }));
    });
  };
`;
function formatElementLine(element) {
  const kind = element.type ? `${element.tag}[${element.type}]` : element.tag,
    role = element.role ? ` role=${element.role}` : '',
    label = element.label ? ` - ${element.label}` : '';
  return `[${element.id}] ${kind}${role}${label}`;
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeTimeout(timeoutMs, fallback = 15e3) {
  const value = Number(timeoutMs);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
export class BrowserMCPServer {
  constructor() {
    ((this._preview = getBrowserPreviewService()),
      (this._consoleLogs = []),
      (this._consoleListenerAttached = !1),
      (this._injectedCssKeys = new Map()));
  }
  async _ensureConsoleCapture() {
    if (!this._consoleListenerAttached)
      try {
        ((await this._getWebContents()).on('console-message', (_event, details) => {
          (this._consoleLogs.push({
            level: String(details.level ?? 'log'),
            message: String(details.message ?? ''),
            line: Number(details.lineNumber ?? 0),
            sourceId: String(details.sourceId ?? ''),
            timestamp: Date.now(),
          }),
            this._consoleLogs.length > 500 && this._consoleLogs.shift());
        }),
          (this._consoleListenerAttached = !0));
      } catch {}
  }
  async listTools() {
    return BROWSER_TOOLS;
  }
  async callTool(name, args = {}) {
    switch ((this._ensureConsoleCapture().catch(() => {}), name)) {
      case 'browser_navigate':
        return this._navigate(args.url);
      case 'browser_snapshot':
        return this._snapshot();
      case 'browser_click':
        return this._click(args.target);
      case 'browser_hover':
        return this._hover(args.target);
      case 'browser_focus':
        return this._focus(args.target);
      case 'browser_type':
        return this._type(args.target, args.text, args);
      case 'browser_clear':
        return this._clear(args.target);
      case 'browser_press_key':
        return this._pressKey(args.key, args.target);
      case 'browser_select_option':
        return this._selectOption(args.target, args.value);
      case 'browser_scroll':
        return this._scroll(args);
      case 'browser_wait':
        return this._wait(args.timeoutMs);
      case 'browser_set_checked':
        return this._setChecked(args.target, args.checked);
      case 'browser_list_options':
        return this._listOptions(args.target);
      case 'browser_list_links':
        return this._listLinks();
      case 'browser_find_elements':
        return this._findElements(args.query, args.limit);
      case 'browser_list_form_fields':
        return this._listFormFields(args.target);
      case 'browser_scroll_into_view':
        return this._scrollIntoView(args.target);
      case 'browser_submit_form':
        return this._submitForm(args.target);
      case 'browser_wait_for_element':
        return this._waitForElement(args.target, args.timeoutMs);
      case 'browser_read_element':
        return this._readElement(args.target);
      case 'browser_wait_for_text':
        return this._waitForText(args.text, args.timeoutMs);
      case 'browser_wait_for_navigation':
        return this._waitForNavigation(args.timeoutMs);
      case 'browser_screenshot':
        return this._screenshot(args.fileName);
      case 'browser_get_state':
        return this._getState();
      case 'browser_back':
        return this._goBack();
      case 'browser_forward':
        return this._goForward();
      case 'browser_refresh':
        return this._refresh();
      case 'browser_double_click':
        return this._doubleClick(args.target);
      case 'browser_right_click':
        return this._rightClick(args.target);
      case 'browser_drag_and_drop':
        return this._dragAndDrop(args.source, args.target);
      case 'browser_click_at':
        return this._clickAt(args.x, args.y);
      case 'browser_get_text':
        return this._getText(args.target);
      case 'browser_get_html':
        return this._getHtml(args.target, args.outer);
      case 'browser_get_attribute':
        return this._getAttribute(args.target, args.attribute);
      case 'browser_set_attribute':
        return this._setAttribute(args.target, args.attribute, args.value);
      case 'browser_remove_attribute':
        return this._removeAttribute(args.target, args.attribute);
      case 'browser_get_computed_style':
        return this._getComputedStyle(args.target, args.property);
      case 'browser_get_element_bounds':
        return this._getElementBounds(args.target);
      case 'browser_count_elements':
        return this._countElements(args.selector, args.visibleOnly);
      case 'browser_extract_table':
        return this._extractTable(args.target);
      case 'browser_get_images':
        return this._getImages(args.visibleOnly);
      case 'browser_get_all_links':
        return this._getAllLinks(args.filter);
      case 'browser_get_page_source':
        return this._getPageSource();
      case 'browser_get_viewport_size':
        return this._getViewportSize();
      case 'browser_set_viewport_size':
        return this._setViewportSize(args.width, args.height);
      case 'browser_set_zoom':
        return this._setZoom(args.factor);
      case 'browser_get_meta_tags':
        return this._getMetaTags();
      case 'browser_execute_script':
        return this._executeScript(args.script);
      case 'browser_inject_css':
        return this._injectCss(args.css);
      case 'browser_highlight_element':
        return this._highlightElement(args.target, args.color, args.durationMs);
      case 'browser_remove_highlights':
        return this._removeHighlights();
      case 'browser_get_cookies':
        return this._getCookies(args.name);
      case 'browser_set_cookie':
        return this._setCookie(args);
      case 'browser_delete_cookie':
        return this._deleteCookie(args.name, args.url);
      case 'browser_clear_cookies':
        return this._clearCookies();
      case 'browser_get_local_storage':
        return this._getLocalStorage(args.key);
      case 'browser_set_local_storage':
        return this._setLocalStorage(args.key, args.value);
      case 'browser_remove_local_storage':
        return this._removeLocalStorage(args.key);
      case 'browser_clear_local_storage':
        return this._clearLocalStorage();
      case 'browser_get_session_storage':
        return this._getSessionStorage(args.key);
      case 'browser_set_session_storage':
        return this._setSessionStorage(args.key, args.value);
      case 'browser_clear_session_storage':
        return this._clearSessionStorage();
      case 'browser_check_element_exists':
        return this._checkElementExists(args.target);
      case 'browser_check_element_visible':
        return this._checkElementVisible(args.target);
      case 'browser_check_text_present':
        return this._checkTextPresent(args.text);
      case 'browser_assert_url_contains':
        return this._assertUrlContains(args.substring);
      case 'browser_assert_title_contains':
        return this._assertTitleContains(args.substring);
      case 'browser_override_dialogs':
        return this._overrideDialogs();
      case 'browser_set_dialog_response':
        return this._setDialogResponse(args.action, args.promptText);
      case 'browser_get_last_dialog':
        return this._getLastDialog();
      case 'browser_get_performance_metrics':
        return this._getPerformanceMetrics();
      case 'browser_get_console_logs':
        return this._getConsoleLogs(args.level, args.limit);
      case 'browser_clear_console_logs':
        return this._clearConsoleLogs();
      case 'browser_get_form_data':
        return this._getFormData(args.target);
      case 'browser_fill_form':
        return this._fillForm(args.fields, args.submit);
      case 'browser_upload_file':
        return this._uploadFile(args.target, args.filePath);
      case 'browser_get_selection':
        return this._getSelection();
      default:
        throw new Error(`Unknown built-in browser tool "${name}".`);
    }
  }
  async close() {
    await this._preview.close();
  }
  async _getWebContents() {
    return this._preview.ensureWebContents();
  }
  async _execute(script, userGesture = !0) {
    return (await this._getWebContents()).executeJavaScript(script, userGesture);
  }
  async _getTextExcerpt(limit = 1200) {
    return this._execute(
      `\n      (() => {\n        const text = String(document.body?.innerText || '').replace(/\\s+/g, ' ').trim();\n        return text.slice(0, ${Number(limit)});\n      })()\n    `,
      !1,
    );
  }
  async _getCurrentPageSummary(
    webContents = null,
    { includeExcerpt: includeExcerpt = !1, excerptLimit: excerptLimit = 240 } = {},
  ) {
    const activeWebContents = webContents ?? (await this._getWebContents()),
      url = activeWebContents.getURL() || '(no page loaded)',
      title = activeWebContents.getTitle() || '(untitled page)',
      excerpt = await this._getTextExcerpt(includeExcerpt ? excerptLimit : 220).catch(() => ''),
      isGoogleBlockPage = (function (text = '') {
        return /google\.com\/sorry|sorry\/index|\bunusual traffic\b|\brecaptcha\b|\bi am not a robot\b|\bi'm not a robot\b/i.test(
          String(text ?? ''),
        );
      })(`${url}\n${title}\n${excerpt}`),
      lines = [
        `Current title: ${title}`,
        `Current URL: ${url}`,
        'Loading: ' + (activeWebContents.isLoading() ? 'yes' : 'no'),
      ];
    return (
      isGoogleBlockPage &&
        (lines.push('Blocked: Google CAPTCHA / unusual-traffic page detected.'),
        lines.push(
          'Suggested recovery: navigate directly to the destination site or use the destination site search instead of Google.',
        )),
      includeExcerpt && excerpt && lines.push(`Visible text: ${excerpt}`),
      lines.join('\n')
    );
  }
  async _waitForActionNavigation(webContents, timeoutMs = 1500) {
    try {
      return (await this._waitForPotentialNavigation(webContents, timeoutMs), '');
    } catch (err) {
      if (
        !(function (error) {
          const message = String(error?.message ?? '');
          return (
            /Timed out waiting for navigation after \d+ms\./i.test(message) ||
            /Timed out waiting for the page to load after \d+ms\./i.test(message)
          );
        })(err)
      )
        throw err;
      return 'Navigation is still settling, so the current page state may still be updating.';
    }
  }
  async _waitForLoadStop(webContents, timeoutMs = 3e4) {
    if (!webContents.isLoading()) return;
    const timeout = normalizeTimeout(timeoutMs, 3e4);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
          (cleanup(),
            reject(new Error(`Timed out waiting for the page to load after ${timeout}ms.`)));
        }, timeout),
        cleanup = () => {
          (clearTimeout(timer),
            webContents.removeListener('did-stop-loading', handleStop),
            webContents.removeListener('did-fail-load', handleFail),
            webContents.removeListener('destroyed', handleDestroyed));
        },
        handleStop = () => {
          (cleanup(), resolve());
        },
        handleFail = (_event, errorCode, errorDescription) => {
          (cleanup(), reject(new Error(`Page load failed (${errorCode}): ${errorDescription}`)));
        },
        handleDestroyed = () => {
          (cleanup(), reject(new Error('Browser preview was destroyed while loading.')));
        };
      (webContents.once('did-stop-loading', handleStop),
        webContents.once('did-fail-load', handleFail),
        webContents.once('destroyed', handleDestroyed));
    });
  }
  async _waitForPotentialNavigation(webContents, timeoutMs = 15e3) {
    const timeout = normalizeTimeout(timeoutMs, 15e3);
    return webContents.isLoading()
      ? (await this._waitForLoadStop(webContents, timeout), 'Navigation finished.')
      : (await new Promise((resolve, reject) => {
          let started = !1;
          const timer = setTimeout(() => {
              (cleanup(),
                started
                  ? reject(new Error(`Timed out waiting for navigation after ${timeout}ms.`))
                  : resolve());
            }, timeout),
            cleanup = () => {
              (clearTimeout(timer),
                webContents.removeListener('did-start-navigation', handleStart),
                webContents.removeListener('did-navigate-in-page', handleInPage),
                webContents.removeListener('did-stop-loading', handleStop),
                webContents.removeListener('did-fail-load', handleFail));
            },
            handleStart = () => {
              started = !0;
            },
            handleInPage = () => {
              ((started = !0), cleanup(), resolve());
            },
            handleStop = () => {
              started && (cleanup(), resolve());
            },
            handleFail = (_event, errorCode, errorDescription) => {
              (cleanup(),
                reject(new Error(`Navigation failed (${errorCode}): ${errorDescription}`)));
            };
          (webContents.on('did-start-navigation', handleStart),
            webContents.on('did-navigate-in-page', handleInPage),
            webContents.on('did-stop-loading', handleStop),
            webContents.once('did-fail-load', handleFail));
        }),
        'Navigation finished.');
  }
  async _navigate(url) {
    const target = (function (rawUrl = '') {
      const trimmed = String(rawUrl ?? '').trim();
      if (!trimmed) throw new Error('A URL is required.');
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    })(url);
    this._preview.setStatus(`Navigating to ${target}`);
    const webContents = await this._preview.loadURL(target),
      title = webContents.getTitle() || '(untitled page)',
      pageSummary = await this._getCurrentPageSummary(webContents, { includeExcerpt: !0 });
    return (this._preview.setStatus(`Opened ${title}`), `Requested URL: ${target}\n${pageSummary}`);
  }
  async _snapshot() {
    this._preview.setStatus('Scanning the current page');
    const result = await this._execute(
        `\n      (() => {\n        ${PAGE_HELPERS}\n        const elements = assignStableIds().map(describeElement);\n        const text = normalizeText(document.body?.innerText || '').slice(0, 3000);\n        const focused = document.activeElement ? describeElement(document.activeElement) : null;\n        return {\n          title: document.title || '(untitled page)',\n          url: location.href || '(no page loaded)',\n          elements,\n          text,\n          focused,\n        };\n      })()\n    `,
        !1,
      ),
      lines = [
        `Title: ${result.title}`,
        `URL: ${result.url}`,
        '',
        'Visible interactive elements:',
        ...(result.elements.length ? result.elements.map(formatElementLine) : ['(none found)']),
      ];
    return (
      (result.focused?.id || result.focused?.label) &&
        lines.splice(2, 0, `Focused element: ${formatElementLine(result.focused)}`, ''),
      result.text && lines.push('', 'Visible text excerpt:', result.text),
      this._preview.clearStatus(),
      lines.join('\n')
    );
  }
  async _click(target) {
    if (!target) throw new Error('Target is required.');
    const webContents = await this._getWebContents();
    this._preview.setStatus(`Clicking ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        focusElement(el);\n        el.click?.();\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not click the requested element.');
    await wait(250);
    const navigationNote = await this._waitForActionNavigation(webContents, 1500),
      pageSummary = await this._getCurrentPageSummary(webContents);
    return (
      this._preview.clearStatus(),
      `Clicked ${formatElementLine(result.info)}${navigationNote ? `\n${navigationNote}` : ''}\n${pageSummary}`
    );
  }
  async _hover(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Hovering ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        focusElement(el);\n        ['pointerenter', 'mouseenter', 'pointerover', 'mouseover'].forEach(type => {\n          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));\n        });\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not hover the requested element.');
    return (this._preview.clearStatus(), `Hovered ${formatElementLine(result.info)}`);
  }
  async _focus(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Focusing ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n        if (!el) return { ok: false, error: 'Element not found.' };\n        const candidate = findNearbyTextField(el) || el;\n        focusElement(candidate);\n        candidate.click?.();\n        return { ok: true, info: describeElement(candidate) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not focus the requested element.');
    return (this._preview.clearStatus(), `Focused ${formatElementLine(result.info)}`);
  }
  async _type(target, text, options = {}) {
    if (!target) throw new Error('Target is required.');
    if (null == text) throw new Error('Text is required.');
    const clearFirst = !1 !== options.clearFirst,
      pressEnter = Boolean(options.pressEnter),
      webContents = await this._getWebContents();
    this._preview.setStatus(`Typing into ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        let el = resolveTarget(${JSON.stringify(target)}, { preferTextField: true, allowFocused: true });\n        if (!el) {\n          const fallback = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n          if (fallback) {\n            focusElement(fallback);\n            fallback.click?.();\n            el = findNearbyTextField(document.activeElement) || findNearbyTextField(fallback);\n          }\n        } else if (!isTextLike(el)) {\n          focusElement(el);\n          el.click?.();\n          el = findNearbyTextField(document.activeElement) || findNearbyTextField(el);\n        }\n\n        if (!el) return { ok: false, error: 'Field not found.' };\n        if (!isTextLike(el)) {\n          return { ok: false, error: 'Target is not a text field. Try browser_focus or browser_click first, then use target "focused".' };\n        }\n\n        focusElement(el);\n        const nextValue = ${clearFirst ? JSON.stringify(String(text)) : `String(el.value ?? el.textContent ?? '') + ${JSON.stringify(String(text))}`};\n        setElementValue(el, nextValue);\n\n        if (${pressEnter ? 'true' : 'false'}) {\n          dispatchKeyboard(el, 'Enter');\n          el.form?.requestSubmit?.();\n        }\n\n        return { ok: true, info: describeElement(el), value: nextValue };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not type into the requested field.');
    await wait(150);
    let navigationNote = '';
    pressEnter && (navigationNote = await this._waitForActionNavigation(webContents, 1e3));
    const pageSummary = await this._getCurrentPageSummary(webContents);
    return (
      this._preview.clearStatus(),
      `Typed into ${formatElementLine(result.info)}\nValue: ${result.value}${navigationNote ? `\n${navigationNote}` : ''}\n${pageSummary}`
    );
  }
  async _clear(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Clearing ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        let el = resolveTarget(${JSON.stringify(target)}, { preferTextField: true, allowFocused: true });\n        if (!el) {\n          const fallback = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n          if (fallback) {\n            focusElement(fallback);\n            fallback.click?.();\n            el = findNearbyTextField(document.activeElement) || findNearbyTextField(fallback);\n          }\n        }\n        if (!el) return { ok: false, error: 'Field not found.' };\n        if (!isTextLike(el)) return { ok: false, error: 'Target is not a text field.' };\n        focusElement(el);\n        setElementValue(el, '');\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not clear the requested field.');
    return (this._preview.clearStatus(), `Cleared ${formatElementLine(result.info)}`);
  }
  async _pressKey(key, target = null) {
    if (!key) throw new Error('Key is required.');
    const webContents = await this._getWebContents();
    this._preview.setStatus(`Pressing ${key}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = ${target ? `resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true })` : '(document.activeElement || document.body)'};\n        if (!el) return { ok: false, error: 'No element is available to receive the key press.' };\n        focusElement(el);\n        dispatchKeyboard(el, ${JSON.stringify(String(key))});\n        if (${JSON.stringify(String(key))} === 'Enter') {\n          el.form?.requestSubmit?.();\n        }\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not press the requested key.');
    await wait(150);
    let navigationNote = '';
    'Enter' === String(key) &&
      (navigationNote = await this._waitForActionNavigation(webContents, 1e3));
    const pageSummary = await this._getCurrentPageSummary(webContents);
    return (
      this._preview.clearStatus(),
      `Pressed ${key}${result.info?.id ? ` on ${formatElementLine(result.info)}` : ''}${navigationNote ? `\n${navigationNote}` : ''}\n${pageSummary}`
    );
  }
  async _selectOption(target, value) {
    if (!target) throw new Error('Target is required.');
    if (null == value) throw new Error('Value is required.');
    this._preview.setStatus(`Selecting ${value}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Select element not found.' };\n        const select = el instanceof HTMLSelectElement ? el : el.querySelector?.('select');\n        if (!(select instanceof HTMLSelectElement)) {\n          return { ok: false, error: 'Target is not a select element.' };\n        }\n        const requested = ${JSON.stringify(String(value))}.toLowerCase();\n        const option = [...select.options].find(entry => {\n          const byValue = String(entry.value || '').toLowerCase();\n          const byLabel = String(entry.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();\n          return byValue === requested || byLabel === requested || byLabel.includes(requested);\n        });\n        if (!option) return { ok: false, error: 'Option not found.' };\n        select.value = option.value;\n        select.dispatchEvent(new Event('input', { bubbles: true }));\n        select.dispatchEvent(new Event('change', { bubbles: true }));\n        return { ok: true, info: describeElement(select), selected: option.textContent?.trim() || option.value };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not select the requested option.');
    return (
      this._preview.clearStatus(),
      `Selected "${result.selected}" in ${formatElementLine(result.info)}`
    );
  }
  async _scroll({
    direction: direction = 'down',
    amount: amount = 600,
    target: target = null,
  } = {}) {
    const normalizedDirection = String(direction ?? 'down').toLowerCase(),
      pixels = Number.isFinite(Number(amount)) ? Number(amount) : 600;
    this._preview.setStatus(`Scrolling ${normalizedDirection}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const scroller = ${target ? `resolveTarget(${JSON.stringify(target)}) || document.scrollingElement || document.documentElement` : 'document.scrollingElement || document.documentElement'};\n        if (!scroller) return { ok: false, error: 'No scrollable target found.' };\n        const isWindowScroll = scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;\n        const dx = ${'left' === normalizedDirection ? -pixels : 'right' === normalizedDirection ? pixels : 0};\n        const dy = ${'up' === normalizedDirection ? -pixels : 'down' === normalizedDirection ? pixels : 0};\n        if (${JSON.stringify(normalizedDirection)} === 'top') {\n          if (isWindowScroll) window.scrollTo({ top: 0, behavior: 'instant' });\n          else scroller.scrollTop = 0;\n        } else if (${JSON.stringify(normalizedDirection)} === 'bottom') {\n          if (isWindowScroll) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });\n          else scroller.scrollTop = scroller.scrollHeight;\n        } else if (isWindowScroll) {\n          window.scrollBy({ left: dx, top: dy, behavior: 'instant' });\n        } else {\n          scroller.scrollBy({ left: dx, top: dy, behavior: 'instant' });\n        }\n        return {\n          ok: true,\n          top: isWindowScroll ? (window.scrollY || document.documentElement.scrollTop || 0) : scroller.scrollTop,\n          left: isWindowScroll ? (window.scrollX || document.documentElement.scrollLeft || 0) : scroller.scrollLeft,\n        };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not scroll the page.');
    return (
      this._preview.clearStatus(),
      `Scrolled ${normalizedDirection}.\nScroll position: top=${Math.round(result.top)}, left=${Math.round(result.left)}`
    );
  }
  async _wait(timeoutMs = 1e3) {
    const timeout = normalizeTimeout(timeoutMs, 1e3);
    return (
      this._preview.setStatus(`Waiting ${timeout}ms`),
      await wait(timeout),
      this._preview.clearStatus(),
      `Waited ${timeout}ms.`
    );
  }
  async _setChecked(target, checked) {
    if (!target) throw new Error('Target is required.');
    if ('boolean' != typeof checked) throw new Error('Checked must be true or false.');
    this._preview.setStatus(`${checked ? 'Checking' : 'Unchecking'} ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n        if (!el) return { ok: false, error: 'Control not found.' };\n        const control = el.matches?.('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="switch"]')\n          ? el\n          : findInteractiveDescendant(el, false);\n        if (!control) return { ok: false, error: 'Control not found.' };\n        const getChecked = node => {\n          if (node instanceof HTMLInputElement) return Boolean(node.checked);\n          const ariaChecked = node.getAttribute?.('aria-checked');\n          if (ariaChecked === 'true') return true;\n          if (ariaChecked === 'false') return false;\n          return null;\n        };\n        const before = getChecked(control);\n        if (before == null) return { ok: false, error: 'Target is not a checkbox or switch-like control.' };\n        if (before !== ${checked ? 'true' : 'false'}) {\n          focusElement(control);\n          control.click?.();\n        }\n        const after = getChecked(control);\n        return { ok: true, info: describeElement(control), checked: Boolean(after) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not update the requested control.');
    return (
      this._preview.clearStatus(),
      `${result.checked ? 'Checked' : 'Unchecked'} ${formatElementLine(result.info)}`
    );
  }
  async _listOptions(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Listing options for ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n        if (!el) return { ok: false, error: 'Control not found.' };\n        const select = el instanceof HTMLSelectElement ? el : el.querySelector?.('select');\n        if (select instanceof HTMLSelectElement) {\n          return {\n            ok: true,\n            info: describeElement(select),\n            options: [...select.options].map((option, index) => ({\n              index: index + 1,\n              label: normalizeText(option.textContent || option.label || option.value),\n              value: String(option.value || ''),\n              selected: option.selected,\n            })),\n          };\n        }\n        const listboxId = el.getAttribute?.('aria-controls');\n        const listbox = listboxId ? document.getElementById(listboxId) : el.closest?.('[role="listbox"]') || document.querySelector('[role="listbox"]');\n        const options = [...(listbox?.querySelectorAll?.('[role="option"]') || [])]\n          .filter(isVisible)\n          .map((option, index) => ({\n            index: index + 1,\n            label: getNodeText(option),\n            value: String(option.getAttribute?.('data-value') || option.getAttribute?.('value') || ''),\n            selected: option.getAttribute?.('aria-selected') === 'true',\n          }));\n        if (!options.length) return { ok: false, error: 'No visible options were found for that control.' };\n        return { ok: true, info: describeElement(el), options };\n      })()\n    `,
      !1,
    );
    if (!result?.ok)
      throw new Error(result?.error ?? 'Could not list options for the requested control.');
    return (
      this._preview.clearStatus(),
      [
        `Options for ${formatElementLine(result.info)}:`,
        ...(result.options.length
          ? result.options.map(
              (option) =>
                `${option.selected ? '*' : '-'} [${option.index}] ${option.label}${option.value ? ` (value: ${option.value})` : ''}`,
            )
          : ['(none found)']),
      ].join('\n')
    );
  }
  async _listLinks() {
    this._preview.setStatus('Listing visible actions');
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const selectors = ['a[href]', 'button', '[role="link"]', '[role="button"]'];\n        const elements = [...document.querySelectorAll(selectors.join(','))]\n          .filter(isVisible)\n          .filter((el, index, arr) => arr.indexOf(el) === index)\n          .slice(0, 120);\n        elements.forEach((el, index) => {\n          if (!el.dataset.owMcpId) el.dataset.owMcpId = 'ow-' + String(index + 1);\n        });\n        return elements.map(el => ({\n          ...describeElement(el),\n          href: el instanceof HTMLAnchorElement ? (el.href || '') : '',\n        }));\n      })()\n    `,
      !1,
    );
    return (
      this._preview.clearStatus(),
      [
        'Visible links and actions:',
        ...(result.length
          ? result.map(
              (entry) => `${formatElementLine(entry)}${entry.href ? ` -> ${entry.href}` : ''}`,
            )
          : ['(none found)']),
      ].join('\n')
    );
  }
  async _findElements(query, limit = 10) {
    if (!query) throw new Error('Query is required.');
    const maxResults = Math.max(
      1,
      Math.min(20, Number.isFinite(Number(limit)) ? Number(limit) : 10),
    );
    this._preview.setStatus(`Finding ${query}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const requested = normalizeText(${JSON.stringify(String(query))});\n        const lowered = requested.toLowerCase();\n        const selectorMatches = [];\n        try {\n          document.querySelectorAll(requested).forEach(node => {\n            const candidate = findInteractiveDescendant(node, false) || node;\n            if (candidate && isVisible(candidate)) selectorMatches.push(candidate);\n          });\n        } catch { /* ignore invalid selectors */ }\n\n        const matches = (selectorMatches.length ? selectorMatches : assignStableIds().filter(candidate => {\n          const values = [\n            candidate.dataset.owMcpId,\n            getElementLabel(candidate),\n            getNodeText(candidate),\n            candidate.placeholder,\n            candidate.getAttribute?.('aria-label'),\n            candidate.getAttribute?.('title'),\n            candidate.name,\n            candidate.id,\n            candidate.getAttribute?.('role'),\n            candidate.tagName,\n          ]\n            .map(value => normalizeText(value).toLowerCase())\n            .filter(Boolean);\n          return values.some(value => value === lowered || value.includes(lowered));\n        }))\n          .map(node => node.tagName === 'LABEL' && node.control ? node.control : node)\n          .filter((node, index, arr) => node && arr.indexOf(node) === index)\n          .slice(0, ${maxResults});\n\n        matches.forEach((node, index) => {\n          if (!node.dataset.owMcpId) node.dataset.owMcpId = 'ow-' + String(index + 1);\n        });\n\n        return matches.map(node => ({\n          ...describeElement(node),\n          text: getNodeText(node),\n          href: node instanceof HTMLAnchorElement ? (node.href || '') : '',\n          disabled: Boolean(node.disabled),\n        }));\n      })()\n    `,
      !1,
    );
    return (
      this._preview.clearStatus(),
      [
        `Matches for "${query}":`,
        ...(result.length
          ? result.map(
              (entry) =>
                `${formatElementLine(entry)}${entry.href ? ` -> ${entry.href}` : ''}${entry.disabled ? ' [disabled]' : ''}${entry.text ? ` | ${entry.text}` : ''}`,
            )
          : ['(none found)']),
      ].join('\n')
    );
  }
  async _listFormFields(target = null) {
    this._preview.setStatus(target ? `Listing fields in ${target}` : 'Listing visible form fields');
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const root = ${target ? `resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true }) || document` : 'document'};\n        const fields = collectVisibleFields(root);\n        fields.forEach((field, index) => {\n          if (!field.dataset.owMcpId) field.dataset.owMcpId = 'ow-' + String(index + 1);\n        });\n        return fields.map(field => {\n          const selectedText = field instanceof HTMLSelectElement\n            ? normalizeText(field.options?.[field.selectedIndex]?.textContent || field.value || '')\n            : '';\n          const value = field instanceof HTMLSelectElement\n            ? selectedText\n            : normalizeText(field.value ?? (field.isContentEditable ? field.textContent : ''));\n          return {\n            ...describeElement(field),\n            placeholder: normalizeText(field.placeholder || ''),\n            value,\n            checked: typeof field.checked === 'boolean' ? field.checked : null,\n            required: Boolean(field.required || field.getAttribute?.('aria-required') === 'true'),\n            disabled: Boolean(field.disabled || field.getAttribute?.('aria-disabled') === 'true'),\n          };\n        });\n      })()\n    `,
      !1,
    );
    return (
      this._preview.clearStatus(),
      [
        target ? `Visible form fields within "${target}":` : 'Visible form fields:',
        ...(result.length
          ? result.map((field) => {
              const details = [
                field.placeholder ? `placeholder: ${field.placeholder}` : '',
                field.value ? `value: ${field.value}` : '',
                null == field.checked ? '' : 'checked: ' + (field.checked ? 'yes' : 'no'),
                field.required ? 'required' : '',
                field.disabled ? 'disabled' : '',
              ]
                .filter(Boolean)
                .join(', ');
              return `${formatElementLine(field)}${details ? ` | ${details}` : ''}`;
            })
          : ['(none found)']),
      ].join('\n')
    );
  }
  async _scrollIntoView(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Scrolling to ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n        if (!el) return { ok: false, error: 'Element not found.' };\n        el.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'instant' });\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
      !1,
    );
    if (!result?.ok)
      throw new Error(result?.error ?? 'Could not scroll the requested element into view.');
    return (this._preview.clearStatus(), `Scrolled to ${formatElementLine(result.info)}`);
  }
  async _submitForm(target = null) {
    const webContents = await this._getWebContents();
    this._preview.setStatus(target ? `Submitting ${target}` : 'Submitting the current form');
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const targetNode = ${target ? `resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true })` : '(document.activeElement || null)'};\n        if (!targetNode) return { ok: false, error: 'No form target is available.' };\n        const form = targetNode.form || targetNode.closest?.('form');\n        const submitSelector = 'button[type="submit"], input[type="submit"], [role="button"][aria-label*="submit" i], [role="button"][aria-label*="continue" i]';\n        if (form) {\n          const submitter = form.querySelector(submitSelector);\n          if (submitter) {\n            focusElement(submitter);\n            submitter.click?.();\n            return { ok: true, mode: 'click', info: describeElement(submitter) };\n          }\n          if (typeof form.requestSubmit === 'function') {\n            form.requestSubmit();\n            return { ok: true, mode: 'submit', info: describeElement(targetNode) };\n          }\n        }\n        if (targetNode.matches?.('button, input[type="submit"], [role="button"]')) {\n          focusElement(targetNode);\n          targetNode.click?.();\n          return { ok: true, mode: 'click', info: describeElement(targetNode) };\n        }\n        focusElement(targetNode);\n        dispatchKeyboard(targetNode, 'Enter');\n        targetNode.form?.requestSubmit?.();\n        return { ok: true, mode: 'enter', info: describeElement(targetNode) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not submit the requested form.');
    await wait(250);
    const navigationNote = await this._waitForActionNavigation(webContents, 1500),
      pageSummary = await this._getCurrentPageSummary(webContents);
    return (
      this._preview.clearStatus(),
      `Submitted via ${result.mode}: ${formatElementLine(result.info)}${navigationNote ? `\n${navigationNote}` : ''}\n${pageSummary}`
    );
  }
  async _waitForElement(target, timeoutMs = 15e3) {
    if (!target) throw new Error('Target is required.');
    const timeout = normalizeTimeout(timeoutMs, 15e3),
      deadline = Date.now() + timeout;
    for (this._preview.setStatus(`Waiting for ${target}`); Date.now() < deadline; ) {
      const result = await this._execute(
        `\n        (() => {\n          ${PAGE_HELPERS}\n          const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n          if (!el || !isVisible(el)) return { ok: false };\n          return { ok: true, info: describeElement(el) };\n        })()\n      `,
        !1,
      );
      if (result?.ok)
        return (
          this._preview.clearStatus(),
          `Element is visible: ${formatElementLine(result.info)}`
        );
      await wait(250);
    }
    throw new Error(`Timed out waiting for "${target}" after ${timeout}ms.`);
  }
  async _readElement(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Reading ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: true });\n        if (!el) return { ok: false, error: 'Element not found.' };\n        const info = describeElement(el);\n        const value = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement\n          ? String(el.value ?? '')\n          : (el.isContentEditable ? String(el.textContent ?? '') : '');\n        const selectedText = el instanceof HTMLSelectElement\n          ? String(el.options?.[el.selectedIndex]?.textContent ?? '').trim()\n          : '';\n        return {\n          ok: true, info,\n          text: getNodeText(el),\n          value: normalizeText(value),\n          checked: typeof el.checked === 'boolean' ? el.checked : null,\n          disabled: Boolean(el.disabled),\n          selectedText,\n        };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not read the requested element.');
    return (
      this._preview.clearStatus(),
      [
        `Element: ${formatElementLine(result.info)}`,
        result.text ? `Visible text: ${result.text}` : '',
        result.value ? `Value: ${result.value}` : '',
        result.selectedText ? `Selected option: ${result.selectedText}` : '',
        null == result.checked ? '' : 'Checked: ' + (result.checked ? 'yes' : 'no'),
        'Disabled: ' + (result.disabled ? 'yes' : 'no'),
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
  async _waitForText(text, timeoutMs = 15e3) {
    if (!text) throw new Error('Text is required.');
    const timeout = normalizeTimeout(timeoutMs, 15e3),
      deadline = Date.now() + timeout,
      target = String(text).toLowerCase();
    for (this._preview.setStatus(`Waiting for "${text}"`); Date.now() < deadline; ) {
      const content = await this._execute(
        "(() => String(document.body?.innerText || '').replace(/\\s+/g, ' ').trim())()",
        !1,
      );
      if (String(content).toLowerCase().includes(target))
        return (this._preview.clearStatus(), `Text found on the page: ${text}`);
      await wait(300);
    }
    throw new Error(`Timed out waiting for "${text}" after ${timeout}ms.`);
  }
  async _waitForNavigation(timeoutMs = 15e3) {
    const webContents = await this._getWebContents(),
      timeout = normalizeTimeout(timeoutMs, 15e3);
    (this._preview.setStatus('Waiting for navigation'),
      await this._waitForPotentialNavigation(webContents, timeout));
    const pageSummary = await this._getCurrentPageSummary(webContents);
    return (this._preview.clearStatus(), `Navigation finished.\n${pageSummary}`);
  }
  async _screenshot(fileName) {
    const webContents = await this._getWebContents();
    this._preview.setStatus('Capturing screenshot');
    const image = await webContents.capturePage(),
      safeName = String(fileName ?? '')
        .trim()
        .replace(/[<>:"/\\|?*]+/g, '-'),
      finalName = safeName
        ? safeName.endsWith('.png')
          ? safeName
          : `${safeName}.png`
        : `Joanium-browser-${Date.now()}.png`,
      screenshotPath = path.join(app.getPath('temp'), finalName);
    return (
      fs.writeFileSync(screenshotPath, image.toPNG()),
      this._preview.clearStatus(),
      `Saved a browser screenshot to ${screenshotPath}`
    );
  }
  async _getState() {
    const webContents = await this._getWebContents();
    return this._getCurrentPageSummary(webContents, { includeExcerpt: !0, excerptLimit: 1200 });
  }
  async _goBack() {
    const webContents = await this._getWebContents();
    if (!webContents.navigationHistory?.canGoBack?.())
      return 'No previous page is available in the built-in browser session.';
    (this._preview.setStatus('Going back'),
      webContents.goBack(),
      await this._waitForPotentialNavigation(webContents, 15e3));
    const pageSummary = await this._getCurrentPageSummary(webContents);
    return (this._preview.clearStatus(), `Navigated back to the previous page.\n${pageSummary}`);
  }
  async _goForward() {
    const webContents = await this._getWebContents();
    if (!webContents.navigationHistory?.canGoForward?.())
      return 'No forward page is available in the built-in browser session.';
    (this._preview.setStatus('Going forward'),
      webContents.goForward(),
      await this._waitForPotentialNavigation(webContents, 15e3));
    const pageSummary = await this._getCurrentPageSummary(webContents);
    return (this._preview.clearStatus(), `Navigated forward to the next page.\n${pageSummary}`);
  }
  async _refresh() {
    const webContents = await this._getWebContents();
    (this._preview.setStatus('Refreshing page'),
      webContents.reload(),
      await this._waitForLoadStop(webContents, 2e4));
    const pageSummary = await this._getCurrentPageSummary(webContents);
    return (this._preview.clearStatus(), `Refreshed the current page.\n${pageSummary}`);
  }
  async _doubleClick(target) {
    if (!target) throw new Error('Target is required.');
    const webContents = await this._getWebContents();
    this._preview.setStatus(`Double-clicking ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        focusElement(el);\n        const rect = el.getBoundingClientRect();\n        const cx = rect.left + rect.width / 2;\n        const cy = rect.top + rect.height / 2;\n        const eventInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, detail: 2 };\n        el.dispatchEvent(new MouseEvent('mousedown', { ...eventInit, detail: 1 }));\n        el.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, detail: 1 }));\n        el.dispatchEvent(new MouseEvent('click', { ...eventInit, detail: 1 }));\n        el.dispatchEvent(new MouseEvent('mousedown', { ...eventInit, detail: 2 }));\n        el.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, detail: 2 }));\n        el.dispatchEvent(new MouseEvent('dblclick', { ...eventInit, detail: 2 }));\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
    );
    if (!result?.ok)
      throw new Error(result?.error ?? 'Could not double-click the requested element.');
    await wait(200);
    const navigationNote = await this._waitForActionNavigation(webContents, 1e3),
      pageSummary = await this._getCurrentPageSummary(webContents);
    return (
      this._preview.clearStatus(),
      `Double-clicked ${formatElementLine(result.info)}${navigationNote ? `\n${navigationNote}` : ''}\n${pageSummary}`
    );
  }
  async _rightClick(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Right-clicking ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        focusElement(el);\n        const rect = el.getBoundingClientRect();\n        const cx = rect.left + rect.width / 2;\n        const cy = rect.top + rect.height / 2;\n        const eventInit = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 2, buttons: 2 };\n        el.dispatchEvent(new MouseEvent('mousedown', eventInit));\n        el.dispatchEvent(new MouseEvent('mouseup', eventInit));\n        el.dispatchEvent(new MouseEvent('contextmenu', eventInit));\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
    );
    if (!result?.ok)
      throw new Error(result?.error ?? 'Could not right-click the requested element.');
    return (this._preview.clearStatus(), `Right-clicked ${formatElementLine(result.info)}`);
  }
  async _dragAndDrop(source, target) {
    if (!source) throw new Error('Source is required.');
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Dragging ${source} → ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const srcEl = resolveTarget(${JSON.stringify(source)});\n        const dstEl = resolveTarget(${JSON.stringify(target)});\n        if (!srcEl) return { ok: false, error: 'Source element not found.' };\n        if (!dstEl) return { ok: false, error: 'Target element not found.' };\n\n        const srcRect = srcEl.getBoundingClientRect();\n        const dstRect = dstEl.getBoundingClientRect();\n        const srcCX = srcRect.left + srcRect.width / 2;\n        const srcCY = srcRect.top + srcRect.height / 2;\n        const dstCX = dstRect.left + dstRect.width / 2;\n        const dstCY = dstRect.top + dstRect.height / 2;\n\n        const dt = new DataTransfer();\n\n        const firePointer = (el, type, x, y, buttons = 1) =>\n          el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, buttons }));\n        const fireMouse = (el, type, x, y, buttons = 1) =>\n          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, buttons }));\n        const fireDrag = (el, type, x, y) =>\n          el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, dataTransfer: dt }));\n\n        firePointer(srcEl, 'pointerdown', srcCX, srcCY);\n        fireMouse(srcEl, 'mousedown', srcCX, srcCY);\n        fireDrag(srcEl, 'dragstart', srcCX, srcCY);\n        fireDrag(srcEl, 'drag', srcCX, srcCY);\n        fireDrag(dstEl, 'dragenter', dstCX, dstCY);\n        fireDrag(dstEl, 'dragover', dstCX, dstCY);\n        fireDrag(dstEl, 'drop', dstCX, dstCY);\n        fireDrag(srcEl, 'dragend', dstCX, dstCY);\n        firePointer(dstEl, 'pointerup', dstCX, dstCY);\n        fireMouse(dstEl, 'mouseup', dstCX, dstCY);\n\n        return { ok: true, srcInfo: describeElement(srcEl), dstInfo: describeElement(dstEl) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not complete drag and drop.');
    return (
      this._preview.clearStatus(),
      `Dragged ${formatElementLine(result.srcInfo)} → ${formatElementLine(result.dstInfo)}`
    );
  }
  async _clickAt(x, y) {
    if (null == x || null == y) throw new Error('x and y coordinates are required.');
    const px = Number(x),
      py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py))
      throw new Error('x and y must be finite numbers.');
    const webContents = await this._getWebContents();
    (this._preview.setStatus(`Clicking at (${px}, ${py})`),
      await this._execute(
        `\n      (() => {\n        const el = document.elementFromPoint(${px}, ${py}) || document.body;\n        const eventInit = { bubbles: true, cancelable: true, view: window, clientX: ${px}, clientY: ${py} };\n        el.dispatchEvent(new MouseEvent('mousedown', eventInit));\n        el.dispatchEvent(new MouseEvent('mouseup', eventInit));\n        el.dispatchEvent(new MouseEvent('click', eventInit));\n      })()\n    `,
      ),
      await wait(200));
    const navigationNote = await this._waitForActionNavigation(webContents, 1e3),
      pageSummary = await this._getCurrentPageSummary(webContents);
    return (
      this._preview.clearStatus(),
      `Clicked at coordinates (${px}, ${py}).${navigationNote ? `\n${navigationNote}` : ''}\n${pageSummary}`
    );
  }
  async _getText(target = null) {
    this._preview.setStatus(target ? `Getting text of ${target}` : 'Getting page text');
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = ${target ? `resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })` : 'document.body'};\n        if (!el) return { ok: false, error: 'Element not found.' };\n        const text = String(el.innerText ?? el.textContent ?? '').replace(/\\s+/g, ' ').trim();\n        return { ok: true, text };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get text.');
    return (this._preview.clearStatus(), result.text || '(no text content)');
  }
  async _getHtml(target = null, outer = !1) {
    this._preview.setStatus(target ? `Getting HTML of ${target}` : 'Getting page HTML');
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = ${target ? `resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })` : 'document.documentElement'};\n        if (!el) return { ok: false, error: 'Element not found.' };\n        const html = ${outer ? 'el.outerHTML' : 'el.innerHTML'} || '';\n        return { ok: true, html: html.slice(0, 50000) };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get HTML.');
    return (this._preview.clearStatus(), result.html || '(empty)');
  }
  async _getAttribute(target, attribute) {
    if (!target) throw new Error('Target is required.');
    if (!attribute) throw new Error('Attribute name is required.');
    this._preview.setStatus(`Getting "${attribute}" from ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })\n          || document.querySelector(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        const value = el.getAttribute(${JSON.stringify(attribute)});\n        return { ok: true, value };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get attribute.');
    return (
      this._preview.clearStatus(),
      null == result.value
        ? `Attribute "${attribute}" is not present on the element.`
        : `${attribute} = ${result.value}`
    );
  }
  async _setAttribute(target, attribute, value) {
    if (!target) throw new Error('Target is required.');
    if (!attribute) throw new Error('Attribute name is required.');
    if (null == value) throw new Error('Value is required.');
    this._preview.setStatus(`Setting "${attribute}" on ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })\n          || document.querySelector(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        el.setAttribute(${JSON.stringify(attribute)}, ${JSON.stringify(String(value))});\n        return { ok: true };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not set attribute.');
    return (this._preview.clearStatus(), `Set attribute "${attribute}" = "${value}" on ${target}.`);
  }
  async _removeAttribute(target, attribute) {
    if (!target) throw new Error('Target is required.');
    if (!attribute) throw new Error('Attribute name is required.');
    this._preview.setStatus(`Removing "${attribute}" from ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })\n          || document.querySelector(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        el.removeAttribute(${JSON.stringify(attribute)});\n        return { ok: true };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not remove attribute.');
    return (this._preview.clearStatus(), `Removed attribute "${attribute}" from ${target}.`);
  }
  async _getComputedStyle(target, property) {
    if (!target) throw new Error('Target is required.');
    if (!property) throw new Error('CSS property is required.');
    this._preview.setStatus(`Getting computed style "${property}" for ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })\n          || document.querySelector(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        const value = window.getComputedStyle(el).getPropertyValue(${JSON.stringify(property)});\n        return { ok: true, value: String(value ?? '').trim() };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get computed style.');
    return (this._preview.clearStatus(), `${property}: ${result.value || '(not set)'}`);
  }
  async _getElementBounds(target) {
    if (!target) throw new Error('Target is required.');
    this._preview.setStatus(`Getting bounds of ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })\n          || document.querySelector(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n        const r = el.getBoundingClientRect();\n        return { ok: true, x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, right: r.right, bottom: r.bottom, left: r.left };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get element bounds.');
    this._preview.clearStatus();
    const {
      x: x,
      y: y,
      width: width,
      height: height,
      top: top,
      right: right,
      bottom: bottom,
      left: left,
    } = result;
    return `Bounds of "${target}":\n  x=${Math.round(x)}, y=${Math.round(y)}\n  width=${Math.round(width)}, height=${Math.round(height)}\n  top=${Math.round(top)}, right=${Math.round(right)}, bottom=${Math.round(bottom)}, left=${Math.round(left)}`;
  }
  async _countElements(selector, visibleOnly = !1) {
    if (!selector) throw new Error('Selector is required.');
    this._preview.setStatus(`Counting elements matching "${selector}"`);
    const result = await this._execute(
      `\n      (() => {\n        ${visibleOnly ? "\n          const isVisible = el => {\n            if (!el) return false;\n            const style = window.getComputedStyle(el);\n            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;\n            const rect = el.getBoundingClientRect();\n            return rect.width > 0 && rect.height > 0;\n          };\n        " : ''}\n        let elements;\n        try {\n          elements = [...document.querySelectorAll(${JSON.stringify(selector)})];\n        } catch (e) {\n          return { ok: false, error: 'Invalid CSS selector: ' + e.message };\n        }\n        const count = ${visibleOnly ? 'elements.filter(isVisible).length' : 'elements.length'};\n        return { ok: true, count };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not count elements.');
    return (
      this._preview.clearStatus(),
      `Found ${result.count} element${1 === result.count ? '' : 's'} matching "${selector}"${visibleOnly ? ' (visible only)' : ''}.`
    );
  }
  async _extractTable(target = null) {
    this._preview.setStatus(target ? `Extracting table "${target}"` : 'Extracting first table');
    const result = await this._execute(
      `\n      (() => {\n        let table;\n        if (${target ? 'true' : 'false'}) {\n          try {\n            table = document.querySelector(${target ? JSON.stringify(target) : 'null'});\n          } catch { /* ignore */ }\n          if (table && table.tagName !== 'TABLE') {\n            table = table.querySelector('table');\n          }\n        } else {\n          table = document.querySelector('table');\n        }\n        if (!table) return { ok: false, error: 'No table found on the page.' };\n\n        const headers = [];\n        const headerRow = table.querySelector('thead tr') || table.querySelector('tr');\n        if (headerRow) {\n          headerRow.querySelectorAll('th, td').forEach(cell => {\n            headers.push(String(cell.innerText ?? cell.textContent ?? '').replace(/\\s+/g, ' ').trim());\n          });\n        }\n\n        const rows = [];\n        const dataRows = [...table.querySelectorAll('tbody tr')];\n        if (!dataRows.length) {\n          // No tbody — grab all rows except the first (header)\n          const allRows = [...table.querySelectorAll('tr')].slice(headers.length ? 1 : 0);\n          allRows.forEach(row => {\n            const cells = [...row.querySelectorAll('td, th')].map(cell =>\n              String(cell.innerText ?? cell.textContent ?? '').replace(/\\s+/g, ' ').trim()\n            );\n            if (cells.some(c => c)) rows.push(cells);\n          });\n        } else {\n          dataRows.forEach(row => {\n            const cells = [...row.querySelectorAll('td, th')].map(cell =>\n              String(cell.innerText ?? cell.textContent ?? '').replace(/\\s+/g, ' ').trim()\n            );\n            if (cells.some(c => c)) rows.push(cells);\n          });\n        }\n\n        // Build array of objects if headers exist\n        const data = headers.length\n          ? rows.map(cells => {\n            const obj = {};\n            headers.forEach((h, i) => { obj[h || String(i)] = cells[i] ?? ''; });\n            return obj;\n          })\n          : rows.map(cells => cells);\n\n        return { ok: true, headers, rowCount: rows.length, data: data.slice(0, 200) };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not extract table.');
    return (
      this._preview.clearStatus(),
      [
        `Table extracted: ${result.rowCount} row${1 === result.rowCount ? '' : 's'}${result.headers.length ? `, columns: ${result.headers.join(', ')}` : ''}`,
        '',
        JSON.stringify(result.data, null, 2),
      ].join('\n')
    );
  }
  async _getImages(visibleOnly = !1) {
    this._preview.setStatus('Listing images');
    const result = await this._execute(
      `\n      (() => {\n        const images = [...document.querySelectorAll('img')];\n        const check = ${visibleOnly ? "el => {\n          const style = window.getComputedStyle(el);\n          if (style.display === 'none' || style.visibility === 'hidden') return false;\n          const rect = el.getBoundingClientRect();\n          return rect.width > 0 && rect.height > 0;\n        }" : '() => true'};\n\n        return images\n          .filter(check)\n          .slice(0, 100)\n          .map(img => ({\n            src: img.src || img.getAttribute('src') || '',\n            alt: String(img.alt || '').trim(),\n            width: img.naturalWidth || img.width || 0,\n            height: img.naturalHeight || img.height || 0,\n            loading: img.loading || '',\n          }));\n      })()\n    `,
      !1,
    );
    if ((this._preview.clearStatus(), !result.length)) return 'No images found on the page.';
    const lines = [`Found ${result.length} image${1 === result.length ? '' : 's'}:`, ''];
    return (
      result.forEach((img, i) => {
        (lines.push(`[${i + 1}] src: ${img.src || '(none)'}`),
          img.alt && lines.push(`     alt: ${img.alt}`),
          (img.width || img.height) && lines.push(`     size: ${img.width}×${img.height}`));
      }),
      lines.join('\n')
    );
  }
  async _getAllLinks(filter = null) {
    this._preview.setStatus('Getting all links');
    const result = await this._execute(
      "\n      (() => {\n        return [...document.querySelectorAll('a[href]')]\n          .slice(0, 300)\n          .map(a => ({\n            href: a.href || '',\n            text: String(a.innerText ?? a.textContent ?? '').replace(/\\s+/g, ' ').trim(),\n            newTab: a.target === '_blank',\n            rel: a.rel || '',\n          }))\n          .filter(link => link.href && link.href !== 'javascript:void(0)');\n      })()\n    ",
      !1,
    );
    this._preview.clearStatus();
    const filtered = filter
      ? result.filter(
          (l) =>
            l.href.includes(filter) || l.text.toLowerCase().includes(String(filter).toLowerCase()),
        )
      : result;
    if (!filtered.length)
      return filter ? `No links found matching "${filter}".` : 'No links found on the page.';
    const lines = [
      `Found ${filtered.length} link${1 === filtered.length ? '' : 's'}${filter ? ` matching "${filter}"` : ''}:`,
      '',
    ];
    return (
      filtered.forEach((link, i) => {
        lines.push(
          `[${i + 1}] ${link.text || '(no text)'} → ${link.href}${link.newTab ? ' [new tab]' : ''}`,
        );
      }),
      lines.join('\n')
    );
  }
  async _getPageSource() {
    this._preview.setStatus('Getting page source');
    const result = await this._execute(
      '\n      (() => document.documentElement.outerHTML)()\n    ',
      !1,
    );
    return (this._preview.clearStatus(), String(result ?? '(empty)'));
  }
  async _getViewportSize() {
    await this._getWebContents();
    const size = await this._execute(
      '\n      (() => ({ width: window.innerWidth, height: window.innerHeight }))()\n    ',
      !1,
    );
    return (this._preview.clearStatus(), `Viewport size: ${size.width}×${size.height} px`);
  }
  async _setViewportSize(width, height) {
    if (!width || !height) throw new Error('Width and height are required.');
    const w = Math.round(Number(width)),
      h = Math.round(Number(height));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 100 || h < 100)
      throw new Error('Width and height must be numbers ≥ 100.');
    const webContents = await this._getWebContents();
    this._preview.setStatus(`Resizing viewport to ${w}×${h}`);
    const win = webContents.getOwnerBrowserWindow();
    if (!win) throw new Error('Could not get the browser window to resize.');
    return (
      win.setContentSize(w, h),
      this._preview.clearStatus(),
      `Viewport resized to ${w}×${h} px.`
    );
  }
  async _setZoom(factor) {
    if (null == factor) throw new Error('Zoom factor is required.');
    const zoom = Number(factor);
    if (!Number.isFinite(zoom) || zoom < 0.1 || zoom > 5)
      throw new Error('Zoom factor must be a number between 0.1 and 5.0.');
    const webContents = await this._getWebContents();
    return (
      this._preview.setStatus(`Setting zoom to ${zoom}`),
      webContents.setZoomFactor(zoom),
      this._preview.clearStatus(),
      `Zoom set to ${zoom} (${Math.round(100 * zoom)}%).`
    );
  }
  async _getMetaTags() {
    this._preview.setStatus('Getting meta tags');
    const result = await this._execute(
      "\n      (() => {\n        return [...document.querySelectorAll('meta')].map(meta => ({\n          name: meta.getAttribute('name') || '',\n          property: meta.getAttribute('property') || '',\n          content: meta.getAttribute('content') || '',\n          charset: meta.getAttribute('charset') || '',\n          httpEquiv: meta.getAttribute('http-equiv') || '',\n        })).filter(m => m.name || m.property || m.content || m.charset || m.httpEquiv);\n      })()\n    ",
      !1,
    );
    if ((this._preview.clearStatus(), !result.length)) return 'No meta tags found.';
    const lines = [`Found ${result.length} meta tag${1 === result.length ? '' : 's'}:`, ''];
    return (
      result.forEach((meta) => {
        const parts = [];
        (meta.charset && parts.push(`charset="${meta.charset}"`),
          meta.httpEquiv && parts.push(`http-equiv="${meta.httpEquiv}"`),
          meta.name && parts.push(`name="${meta.name}"`),
          meta.property && parts.push(`property="${meta.property}"`),
          meta.content && parts.push(`content="${meta.content}"`),
          lines.push(`  <meta ${parts.join(' ')}>`));
      }),
      lines.join('\n')
    );
  }
  async _executeScript(script) {
    if (!script) throw new Error('Script is required.');
    let wrappedScript, result;
    (this._preview.setStatus('Executing script'),
      (wrappedScript =
        script.trim().startsWith('(') || script.trim().startsWith('async')
          ? script
          : `(async () => { ${script} })()`));
    try {
      result = await this._execute(wrappedScript);
    } catch (err) {
      throw new Error(`Script execution failed: ${err.message}`);
    }
    return (
      this._preview.clearStatus(),
      null == result
        ? 'Script executed. No return value.'
        : 'object' == typeof result
          ? `Script result:\n${JSON.stringify(result, null, 2)}`
          : `Script result: ${String(result)}`
    );
  }
  async _injectCss(css) {
    if (!css) throw new Error('CSS is required.');
    const webContents = await this._getWebContents();
    this._preview.setStatus('Injecting CSS');
    const key = await webContents.insertCSS(String(css));
    return (
      this._injectedCssKeys.set(key, css),
      this._preview.clearStatus(),
      `CSS injected successfully. Injection key: ${key}`
    );
  }
  async _highlightElement(target, color = 'red', durationMs = 3e3) {
    if (!target) throw new Error('Target is required.');
    const safeColor = String(color ?? 'red').replace(/['"<>]/g, ''),
      duration = Number(durationMs ?? 3e3);
    this._preview.setStatus(`Highlighting ${target}`);
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        const el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false })\n          || document.querySelector(${JSON.stringify(target)});\n        if (!el) return { ok: false, error: 'Element not found.' };\n\n        el.scrollIntoView?.({ block: 'center', behavior: 'instant' });\n        const prev = el.style.outline;\n        const prevOffset = el.style.outlineOffset;\n        el.style.outline = '3px solid ${safeColor}';\n        el.style.outlineOffset = '2px';\n        el.dataset.owHighlighted = 'true';\n\n        if (${duration > 0 ? 'true' : 'false'}) {\n          setTimeout(() => {\n            el.style.outline = prev;\n            el.style.outlineOffset = prevOffset;\n            delete el.dataset.owHighlighted;\n          }, ${Math.max(0, duration)});\n        }\n\n        return { ok: true, info: describeElement(el) };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not highlight the element.');
    return (
      this._preview.clearStatus(),
      `Highlighted ${formatElementLine(result.info)} in ${safeColor}${duration > 0 ? ` for ${duration}ms` : ' (permanent until removed)'}.`
    );
  }
  async _removeHighlights() {
    return (
      this._preview.setStatus('Removing highlights'),
      await this._execute(
        "\n      (() => {\n        document.querySelectorAll('[data-ow-highlighted]').forEach(el => {\n          el.style.outline = '';\n          el.style.outlineOffset = '';\n          delete el.dataset.owHighlighted;\n        });\n      })()\n    ",
      ),
      this._preview.clearStatus(),
      'All element highlights removed.'
    );
  }
  async _getCookies(name = null) {
    const webContents = await this._getWebContents(),
      url = webContents.getURL();
    this._preview.setStatus('Getting cookies');
    const filter = { url: url };
    name && (filter.name = String(name));
    const cookies = await webContents.session.cookies.get(filter);
    if ((this._preview.clearStatus(), !cookies.length))
      return name ? `No cookie named "${name}" found.` : 'No cookies found for this page.';
    const lines = [`${cookies.length} cookie${1 === cookies.length ? '' : 's'}:`, ''];
    return (
      cookies.forEach((c) => {
        const parts = [`name="${c.name}"`, `value="${c.value}"`];
        (c.domain && parts.push(`domain="${c.domain}"`),
          c.path && parts.push(`path="${c.path}"`),
          c.secure && parts.push('secure'),
          c.httpOnly && parts.push('httpOnly'),
          c.expirationDate &&
            parts.push(`expires=${new Date(1e3 * c.expirationDate).toISOString()}`),
          lines.push(`  ${parts.join(', ')}`));
      }),
      lines.join('\n')
    );
  }
  async _setCookie({
    name: name,
    value: value,
    domain: domain,
    path: cookiePath,
    secure: secure,
    httpOnly: httpOnly,
    expirationDate: expirationDate,
  } = {}) {
    if (!name) throw new Error('Cookie name is required.');
    if (null == value) throw new Error('Cookie value is required.');
    const webContents = await this._getWebContents(),
      url = webContents.getURL();
    this._preview.setStatus(`Setting cookie "${name}"`);
    const details = { url: url, name: String(name), value: String(value) };
    return (
      domain && (details.domain = String(domain)),
      cookiePath && (details.path = String(cookiePath)),
      'boolean' == typeof secure && (details.secure = secure),
      'boolean' == typeof httpOnly && (details.httpOnly = httpOnly),
      null != expirationDate && (details.expirationDate = Number(expirationDate)),
      await webContents.session.cookies.set(details),
      this._preview.clearStatus(),
      `Cookie "${name}" set successfully.`
    );
  }
  async _deleteCookie(name, url = null) {
    if (!name) throw new Error('Cookie name is required.');
    const webContents = await this._getWebContents(),
      targetUrl = url || webContents.getURL();
    return (
      this._preview.setStatus(`Deleting cookie "${name}"`),
      await webContents.session.cookies.remove(targetUrl, String(name)),
      this._preview.clearStatus(),
      `Cookie "${name}" deleted.`
    );
  }
  async _clearCookies() {
    const webContents = await this._getWebContents(),
      url = webContents.getURL();
    this._preview.setStatus('Clearing cookies');
    const cookies = await webContents.session.cookies.get({ url: url });
    return (
      await Promise.all(cookies.map((c) => webContents.session.cookies.remove(url, c.name))),
      this._preview.clearStatus(),
      `Cleared ${cookies.length} cookie${1 === cookies.length ? '' : 's'}.`
    );
  }
  async _getLocalStorage(key = null) {
    this._preview.setStatus(key ? `Getting localStorage["${key}"]` : 'Getting all localStorage');
    const result = await this._execute(
      `\n      (() => {\n        try {\n          if (${key ? 'true' : 'false'}) {\n            const v = localStorage.getItem(${key ? JSON.stringify(key) : 'null'});\n            return { ok: true, single: true, value: v };\n          }\n          const items = {};\n          for (let i = 0; i < localStorage.length; i++) {\n            const k = localStorage.key(i);\n            items[k] = localStorage.getItem(k);\n          }\n          return { ok: true, single: false, items };\n        } catch (e) {\n          return { ok: false, error: e.message };\n        }\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not access localStorage.');
    if ((this._preview.clearStatus(), result.single))
      return null == result.value
        ? `localStorage["${key}"] is not set.`
        : `localStorage["${key}"] = ${result.value}`;
    const entries = Object.entries(result.items);
    if (!entries.length) return 'localStorage is empty.';
    const lines = [`localStorage (${entries.length} item${1 === entries.length ? '' : 's'}):`, ''];
    return (entries.forEach(([k, v]) => lines.push(`  "${k}": ${v}`)), lines.join('\n'));
  }
  async _setLocalStorage(key, value) {
    if (!key) throw new Error('Key is required.');
    if (null == value) throw new Error('Value is required.');
    this._preview.setStatus(`Setting localStorage["${key}"]`);
    const result = await this._execute(
      `\n      (() => {\n        try {\n          localStorage.setItem(${JSON.stringify(String(key))}, ${JSON.stringify(String(value))});\n          return { ok: true };\n        } catch (e) {\n          return { ok: false, error: e.message };\n        }\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not set localStorage item.');
    return (this._preview.clearStatus(), `localStorage["${key}"] set to "${value}".`);
  }
  async _removeLocalStorage(key) {
    if (!key) throw new Error('Key is required.');
    this._preview.setStatus(`Removing localStorage["${key}"]`);
    const result = await this._execute(
      `\n      (() => {\n        try {\n          localStorage.removeItem(${JSON.stringify(String(key))});\n          return { ok: true };\n        } catch (e) {\n          return { ok: false, error: e.message };\n        }\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not remove localStorage item.');
    return (this._preview.clearStatus(), `localStorage["${key}"] removed.`);
  }
  async _clearLocalStorage() {
    this._preview.setStatus('Clearing localStorage');
    const result = await this._execute(
      '\n      (() => {\n        try {\n          const count = localStorage.length;\n          localStorage.clear();\n          return { ok: true, count };\n        } catch (e) {\n          return { ok: false, error: e.message };\n        }\n      })()\n    ',
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not clear localStorage.');
    return (
      this._preview.clearStatus(),
      `localStorage cleared (${result.count} item${1 === result.count ? '' : 's'} removed).`
    );
  }
  async _getSessionStorage(key = null) {
    this._preview.setStatus(
      key ? `Getting sessionStorage["${key}"]` : 'Getting all sessionStorage',
    );
    const result = await this._execute(
      `\n      (() => {\n        try {\n          if (${key ? 'true' : 'false'}) {\n            const v = sessionStorage.getItem(${key ? JSON.stringify(key) : 'null'});\n            return { ok: true, single: true, value: v };\n          }\n          const items = {};\n          for (let i = 0; i < sessionStorage.length; i++) {\n            const k = sessionStorage.key(i);\n            items[k] = sessionStorage.getItem(k);\n          }\n          return { ok: true, single: false, items };\n        } catch (e) {\n          return { ok: false, error: e.message };\n        }\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not access sessionStorage.');
    if ((this._preview.clearStatus(), result.single))
      return null == result.value
        ? `sessionStorage["${key}"] is not set.`
        : `sessionStorage["${key}"] = ${result.value}`;
    const entries = Object.entries(result.items);
    if (!entries.length) return 'sessionStorage is empty.';
    const lines = [
      `sessionStorage (${entries.length} item${1 === entries.length ? '' : 's'}):`,
      '',
    ];
    return (entries.forEach(([k, v]) => lines.push(`  "${k}": ${v}`)), lines.join('\n'));
  }
  async _setSessionStorage(key, value) {
    if (!key) throw new Error('Key is required.');
    if (null == value) throw new Error('Value is required.');
    this._preview.setStatus(`Setting sessionStorage["${key}"]`);
    const result = await this._execute(
      `\n      (() => {\n        try {\n          sessionStorage.setItem(${JSON.stringify(String(key))}, ${JSON.stringify(String(value))});\n          return { ok: true };\n        } catch (e) {\n          return { ok: false, error: e.message };\n        }\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not set sessionStorage item.');
    return (this._preview.clearStatus(), `sessionStorage["${key}"] set to "${value}".`);
  }
  async _clearSessionStorage() {
    this._preview.setStatus('Clearing sessionStorage');
    const result = await this._execute(
      '\n      (() => {\n        try {\n          const count = sessionStorage.length;\n          sessionStorage.clear();\n          return { ok: true, count };\n        } catch (e) {\n          return { ok: false, error: e.message };\n        }\n      })()\n    ',
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not clear sessionStorage.');
    return (
      this._preview.clearStatus(),
      `sessionStorage cleared (${result.count} item${1 === result.count ? '' : 's'} removed).`
    );
  }
  async _checkElementExists(target) {
    if (!target) throw new Error('Target is required.');
    return (
      await this._execute(
        `\n      (() => {\n        let el = null;\n        try { el = document.querySelector(${JSON.stringify(target)}); } catch { /* invalid selector */ }\n        return { exists: Boolean(el) };\n      })()\n    `,
        !1,
      )
    ).exists
      ? `true — element "${target}" exists in the DOM.`
      : `false — element "${target}" was not found.`;
  }
  async _checkElementVisible(target) {
    if (!target) throw new Error('Target is required.');
    return (
      await this._execute(
        `\n      (() => {\n        ${PAGE_HELPERS}\n        let el = null;\n        try { el = document.querySelector(${JSON.stringify(target)}); } catch { /* invalid selector */ }\n        if (!el) {\n          el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false });\n        }\n        if (!el) return { visible: false };\n        return { visible: isVisible(el) };\n      })()\n    `,
        !1,
      )
    ).visible
      ? `true — element "${target}" is visible.`
      : `false — element "${target}" is not visible or not found.`;
  }
  async _checkTextPresent(text) {
    if (!text) throw new Error('Text is required.');
    const bodyText = await this._execute(
      "\n      (() => String(document.body?.innerText || '').toLowerCase())()\n    ",
      !1,
    );
    return String(bodyText).includes(String(text).toLowerCase())
      ? `true — "${text}" is present on the page.`
      : `false — "${text}" was not found on the page.`;
  }
  async _assertUrlContains(substring) {
    if (!substring) throw new Error('Substring is required.');
    const url = (await this._getWebContents()).getURL();
    if (!url.includes(String(substring)))
      throw new Error(
        `URL assertion failed.\nExpected URL to contain: "${substring}"\nActual URL: ${url}`,
      );
    return `URL assertion passed — current URL contains "${substring}".\nURL: ${url}`;
  }
  async _assertTitleContains(substring) {
    if (!substring) throw new Error('Substring is required.');
    const title = (await this._getWebContents()).getTitle();
    if (!title.includes(String(substring)))
      throw new Error(
        `Title assertion failed.\nExpected title to contain: "${substring}"\nActual title: ${title}`,
      );
    return `Title assertion passed — page title contains "${substring}".\nTitle: ${title}`;
  }
  async _overrideDialogs() {
    return (
      this._preview.setStatus('Installing dialog overrides'),
      await this._execute(
        "\n      (() => {\n        if (window.__owDialogsOverridden) return;\n        window.__owDialogsOverridden = true;\n        window.__owDialogConfig = { action: 'accept', promptText: '' };\n        window.__owLastDialog = null;\n\n        const origAlert = window.alert.bind(window);\n        const origConfirm = window.confirm.bind(window);\n        const origPrompt = window.prompt.bind(window);\n\n        window.alert = function(message) {\n          window.__owLastDialog = { type: 'alert', message: String(message ?? ''), result: null, timestamp: Date.now() };\n        };\n\n        window.confirm = function(message) {\n          const accepted = window.__owDialogConfig.action !== 'dismiss';\n          window.__owLastDialog = { type: 'confirm', message: String(message ?? ''), result: accepted, timestamp: Date.now() };\n          return accepted;\n        };\n\n        window.prompt = function(message, defaultValue) {\n          const accepted = window.__owDialogConfig.action !== 'dismiss';\n          const text = accepted ? (window.__owDialogConfig.promptText || String(defaultValue ?? '')) : null;\n          window.__owLastDialog = { type: 'prompt', message: String(message ?? ''), result: text, timestamp: Date.now() };\n          return text;\n        };\n      })()\n    ",
      ),
      this._preview.clearStatus(),
      'Dialog overrides installed. window.alert, window.confirm, and window.prompt are now intercepted.'
    );
  }
  async _setDialogResponse(action, promptText = '') {
    if (!action) throw new Error('Action is required ("accept" or "dismiss").');
    const normalizedAction = String(action).toLowerCase();
    if ('accept' !== normalizedAction && 'dismiss' !== normalizedAction)
      throw new Error('Action must be "accept" or "dismiss".');
    this._preview.setStatus(`Setting dialog response: ${normalizedAction}`);
    const result = await this._execute(
      `\n      (() => {\n        if (!window.__owDialogConfig) {\n          return { ok: false, error: 'Dialog overrides not installed. Call browser_override_dialogs first.' };\n        }\n        window.__owDialogConfig.action = ${JSON.stringify(normalizedAction)};\n        window.__owDialogConfig.promptText = ${JSON.stringify(String(promptText ?? ''))};\n        return { ok: true };\n      })()\n    `,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not set dialog response.');
    return (
      this._preview.clearStatus(),
      `Dialog response set: action="${normalizedAction}"${promptText ? `, promptText="${promptText}"` : ''}.`
    );
  }
  async _getLastDialog() {
    this._preview.setStatus('Getting last dialog');
    const result = await this._execute(
      "\n      (() => {\n        if (!window.__owDialogsOverridden) return { ok: false, error: 'Dialog overrides not installed. Call browser_override_dialogs first.' };\n        return { ok: true, dialog: window.__owLastDialog };\n      })()\n    ",
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get last dialog.');
    if ((this._preview.clearStatus(), !result.dialog)) return 'No dialog has been intercepted yet.';
    const {
        type: type,
        message: message,
        result: dialogResult,
        timestamp: timestamp,
      } = result.dialog,
      time = new Date(timestamp).toISOString();
    return [
      'Last intercepted dialog:',
      `  Type: ${type}`,
      `  Message: ${message}`,
      `  Result: ${null == dialogResult ? 'null (dismissed)' : String(dialogResult)}`,
      `  Time: ${time}`,
    ].join('\n');
  }
  async _getPerformanceMetrics() {
    this._preview.setStatus('Getting performance metrics');
    const result = await this._execute(
      "\n      (() => {\n        const timing = performance?.timing;\n        const nav = performance?.getEntriesByType?.('navigation')?.[0];\n        if (!timing && !nav) return { ok: false, error: 'Performance API not available.' };\n\n        if (nav) {\n          return {\n            ok: true,\n            source: 'PerformanceNavigationTiming',\n            dnsLookup: Math.round(nav.domainLookupEnd - nav.domainLookupStart),\n            tcpConnect: Math.round(nav.connectEnd - nav.connectStart),\n            ttfb: Math.round(nav.responseStart - nav.requestStart),\n            responseTime: Math.round(nav.responseEnd - nav.responseStart),\n            domInteractive: Math.round(nav.domInteractive - nav.startTime),\n            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),\n            loadComplete: Math.round(nav.loadEventEnd - nav.startTime),\n            transferSize: nav.transferSize || 0,\n            encodedBodySize: nav.encodedBodySize || 0,\n          };\n        }\n\n        return {\n          ok: true,\n          source: 'PerformanceTiming (legacy)',\n          dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,\n          tcpConnect: timing.connectEnd - timing.connectStart,\n          ttfb: timing.responseStart - timing.requestStart,\n          responseTime: timing.responseEnd - timing.responseStart,\n          domInteractive: timing.domInteractive - timing.navigationStart,\n          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,\n          loadComplete: timing.loadEventEnd - timing.navigationStart,\n        };\n      })()\n    ",
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get performance metrics.');
    this._preview.clearStatus();
    const lines = [`Performance metrics (${result.source}):`];
    return (
      null != result.dnsLookup && lines.push(`  DNS lookup:          ${result.dnsLookup}ms`),
      null != result.tcpConnect && lines.push(`  TCP connect:         ${result.tcpConnect}ms`),
      null != result.ttfb && lines.push(`  Time to first byte:  ${result.ttfb}ms`),
      null != result.responseTime && lines.push(`  Response time:       ${result.responseTime}ms`),
      null != result.domInteractive &&
        lines.push(`  DOM interactive:     ${result.domInteractive}ms`),
      null != result.domContentLoaded &&
        lines.push(`  DOMContentLoaded:    ${result.domContentLoaded}ms`),
      null != result.loadComplete && lines.push(`  Load complete:       ${result.loadComplete}ms`),
      null != result.transferSize &&
        lines.push(`  Transfer size:       ${(result.transferSize / 1024).toFixed(1)}KB`),
      lines.join('\n')
    );
  }
  async _getConsoleLogs(level = null, limit = 50) {
    const maxEntries = Math.max(
        1,
        Math.min(500, Number.isFinite(Number(limit)) ? Number(limit) : 50),
      ),
      levelFilter = level ? String(level).toLowerCase() : null;
    let logs = this._consoleLogs;
    if (levelFilter) {
      const mappedLevel =
        { log: 'verbose', warn: 'warning', warning: 'warning', error: 'error', info: 'info' }[
          levelFilter
        ] || levelFilter;
      logs = logs.filter((e) => e.level === mappedLevel || e.level === levelFilter);
    }
    const recent = logs.slice(-maxEntries);
    if (!recent.length)
      return level ? `No ${level} logs captured.` : 'No console logs captured yet.';
    const lines = [`Console logs (${recent.length} of ${logs.length} total):`, ''];
    return (
      recent.forEach((entry) => {
        const time = new Date(entry.timestamp).toISOString().split('T')[1].replace('Z', '');
        lines.push(`[${time}] [${entry.level.toUpperCase()}] ${entry.message}`);
      }),
      lines.join('\n')
    );
  }
  async _clearConsoleLogs() {
    const count = this._consoleLogs.length;
    return (
      (this._consoleLogs = []),
      `Console log buffer cleared (${count} entr${1 === count ? 'y' : 'ies'} removed).`
    );
  }
  async _getFormData(target = null) {
    this._preview.setStatus(target ? `Getting form data from ${target}` : 'Getting form data');
    const result = await this._execute(
      `\n      (() => {\n        ${PAGE_HELPERS}\n        let form;\n        if (${target ? 'true' : 'false'}) {\n          try { form = document.querySelector(${target ? JSON.stringify(target) : 'null'}); } catch { /* ignore */ }\n          if (form && form.tagName !== 'FORM') form = form.closest?.('form') || form.querySelector?.('form');\n        } else {\n          form = document.querySelector('form');\n        }\n\n        if (!form) return { ok: false, error: 'No form found on the page.' };\n\n        const data = {};\n        const fd = new FormData(form instanceof HTMLFormElement ? form : undefined);\n        if (form instanceof HTMLFormElement) {\n          for (const [key, value] of fd.entries()) {\n            if (key in data) {\n              data[key] = Array.isArray(data[key]) ? [...data[key], String(value)] : [data[key], String(value)];\n            } else {\n              data[key] = String(value);\n            }\n          }\n        } else {\n          // Fallback: collect manually\n          collectVisibleFields(form).forEach(field => {\n            const key = field.name || field.id || getElementLabel(field);\n            if (!key) return;\n            let value;\n            if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {\n              value = field.checked;\n            } else if (field instanceof HTMLSelectElement) {\n              value = field.value;\n            } else {\n              value = field.value ?? (field.isContentEditable ? field.textContent : '');\n            }\n            data[key] = value;\n          });\n        }\n\n        return { ok: true, data, action: form.action || '', method: (form.method || 'get').toUpperCase() };\n      })()\n    `,
      !1,
    );
    if (!result?.ok) throw new Error(result?.error ?? 'Could not get form data.');
    return (
      this._preview.clearStatus(),
      [
        `Form data (action="${result.action}", method=${result.method}):`,
        '',
        JSON.stringify(result.data, null, 2),
      ].join('\n')
    );
  }
  async _fillForm(fields, submit = !1) {
    if (!fields || 'object' != typeof fields) throw new Error('Fields must be a JSON object.');
    const entries = Object.entries(fields);
    if (!entries.length) throw new Error('Fields object is empty.');
    this._preview.setStatus(
      `Filling ${entries.length} form field${1 === entries.length ? '' : 's'}`,
    );
    const results = [];
    for (const [fieldTarget, value] of entries)
      try {
        const result = await this._execute(
          `\n          (() => {\n            ${PAGE_HELPERS}\n            let el = resolveTarget(${JSON.stringify(String(fieldTarget))}, { preferTextField: true, allowFocused: false });\n            if (!el) {\n              // Try by name attribute\n              el = document.querySelector('[name="${String(fieldTarget).replace(/"/g, '\\"')}"]');\n            }\n            if (!el) return { ok: false, target: ${JSON.stringify(String(fieldTarget))}, error: 'Field not found.' };\n\n            if (el instanceof HTMLSelectElement) {\n              const requested = ${JSON.stringify(String(value))}.toLowerCase();\n              const option = [...el.options].find(o =>\n                String(o.value).toLowerCase() === requested || String(o.textContent).replace(/\\s+/g, ' ').trim().toLowerCase() === requested\n              );\n              if (!option) return { ok: false, target: ${JSON.stringify(String(fieldTarget))}, error: 'Option not found in select.' };\n              el.value = option.value;\n              el.dispatchEvent(new Event('input', { bubbles: true }));\n              el.dispatchEvent(new Event('change', { bubbles: true }));\n            } else if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {\n              const shouldCheck = ${JSON.stringify(String(value))}.toLowerCase() !== 'false' && ${JSON.stringify(String(value))} !== '0';\n              if (el.checked !== shouldCheck) el.click();\n            } else {\n              focusElement(el);\n              setElementValue(el, ${JSON.stringify(String(value))});\n            }\n            return { ok: true, target: ${JSON.stringify(String(fieldTarget))} };\n          })()\n        `,
        );
        results.push(
          result?.ok ? `✓ "${fieldTarget}" = "${value}"` : `✗ "${fieldTarget}": ${result?.error}`,
        );
      } catch (err) {
        results.push(`✗ "${fieldTarget}": ${err.message}`);
      }
    if (submit)
      try {
        (await this._submitForm(null), results.push('✓ Form submitted.'));
      } catch (err) {
        results.push(`✗ Submit failed: ${err.message}`);
      }
    return (
      this._preview.clearStatus(),
      [`Form fill results (${entries.length} fields):`, '', ...results].join('\n')
    );
  }
  async _uploadFile(target, filePath) {
    if (!target) throw new Error('Target is required.');
    if (!filePath) throw new Error('File path is required.');
    const resolvedPath = path.resolve(String(filePath));
    if (!fs.existsSync(resolvedPath)) throw new Error(`File not found: ${resolvedPath}`);
    const webContents = await this._getWebContents();
    this._preview.setStatus(`Uploading ${path.basename(resolvedPath)}`);
    const dbg = webContents.debugger;
    let attached = !1;
    try {
      (dbg.attach('1.3'), (attached = !0));
    } catch {}
    try {
      const evalResult = await dbg.sendCommand('Runtime.evaluate', {
        expression: `\n          (() => {\n            ${PAGE_HELPERS}\n            let el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false });\n            if (!el) {\n              try { el = document.querySelector(${JSON.stringify(target)}); } catch { /* ignore */ }\n            }\n            return el;\n          })()\n        `,
        returnByValue: !1,
      });
      if (!evalResult.result?.objectId) throw new Error('File input element not found.');
      const { nodeId: nodeId } = await dbg.sendCommand('DOM.requestNode', {
        objectId: evalResult.result.objectId,
      });
      if (!nodeId) throw new Error('Could not resolve DOM node for file input.');
      (await dbg.sendCommand('DOM.setFileInputFiles', { files: [resolvedPath], nodeId: nodeId }),
        await this._execute(
          `\n        (() => {\n          ${PAGE_HELPERS}\n          let el = resolveTarget(${JSON.stringify(target)}, { preferTextField: false, allowFocused: false });\n          if (!el) { try { el = document.querySelector(${JSON.stringify(target)}); } catch { /* ignore */ } }\n          if (el) {\n            el.dispatchEvent(new Event('change', { bubbles: true }));\n            el.dispatchEvent(new Event('input', { bubbles: true }));\n          }\n        })()\n      `,
        ));
    } finally {
      if (attached)
        try {
          dbg.detach();
        } catch {}
    }
    return (
      this._preview.clearStatus(),
      `File "${path.basename(resolvedPath)}" set on input "${target}".\nFull path: ${resolvedPath}`
    );
  }
  async _getSelection() {
    this._preview.setStatus('Getting selected text');
    const result = await this._execute(
      "\n      (() => {\n        const sel = window.getSelection();\n        const text = sel ? sel.toString() : '';\n        return { text, rangeCount: sel?.rangeCount ?? 0 };\n      })()\n    ",
      !1,
    );
    return (
      this._preview.clearStatus(),
      result.text
        ? `Selected text (${result.text.length} char${1 === result.text.length ? '' : 's'}):\n${result.text}`
        : 'No text is currently selected.'
    );
  }
}
let _browserServer = null;
export function getBuiltinBrowserServer() {
  return (_browserServer || (_browserServer = new BrowserMCPServer()), _browserServer);
}
