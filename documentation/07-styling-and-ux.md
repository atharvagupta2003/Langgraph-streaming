# Styling and UX

Liquid glass
- globals.css defines utilities; glass class used across containers.
- Translucent backgrounds, subtle borders, backdrop blur.

Header
- Auto-hides on scroll; hover strip reveals; half-translate with reduced opacity so it never obscures content.

Responsive layout
- Message/input containers expand to near-full width with viewport-based caps.
- Sidebar collapses; + button accessible when collapsed.

Scrolling
- Lenis initialized with nested scroll allowed.
- data-lenis-prevent on messages area and ToolCallCard code blocks.
- Scroll-to-bottom button only when not at bottom.

Markdown
- react-markdown + remark-gfm; links are clickable (new tab).
- Spacing tightened: paragraphs/lists with compact margins.

Tool cards
- Combined args/result view; tabs; copy; scrollable blocks; loading pulse.
