## Design Context

### Users
Hardcore roleplayers and AI enthusiasts using SillyTavern. They care about immersion, branching story control, persistent memory, and high-agency authoring tools. They are often advanced users, but the product must not assume they want every system-level control exposed at once. The interface should help them stay focused on the current creative task while revealing deeper controls only when needed.

### Brand Personality
- **Voice**: Calm, precise, and reliable.
- **Tone**: Premium creative workstation. It should feel more like a focused authoring environment than a feature-stacked plugin dashboard.
- **3-word personality**: Quiet, Orchestrated, Trustworthy.
- **Emotional goals**: Focus (I know what to do now), Confidence (the system is coherent and remembers), Control (advanced power is available when I need it), Relief (complexity is organized, not dumped on me).

### Aesthetic Direction
- **Visual tone**: Quiet workstation. Borrow the calm, structured feel of modern desktop tools, but do not mimic any single product's layout. Emphasis should come from hierarchy, spacing, and continuity instead of heavy card chrome or loud brand color.
- **References**: Modern authoring tools and thoughtful desktop workspaces with stable split-pane layouts and restrained emphasis.
- **Anti-references**: Generic AI dashboards, over-carded admin panels, neon-dark "AI" aesthetics, and interfaces that expose all internal systems at once.
- **Theme**: Light-first neutral palette with subtle cool tinting. Brand blue-violet remains part of the identity, but only as a sparse accent for focus, selected states, and primary intent.

### Design Principles
1. **Primary Task First**: Every screen must make the current task obvious within seconds. Supporting systems should orbit the task instead of competing with it.
2. **Progressive Disclosure**: Advanced controls, sync tools, and system detail should appear when relevant, not all at once by default.
3. **One Workstation, Not Many Cards**: Favor coherent panes, rails, and sections over piles of independent cards.
4. **Calm Precision**: Use restrained color, subtle separation, and strong typography to create trust and reduce cognitive noise.
5. **Absolute Isolation**: Styles must remain encapsulated (Shadow DOM) and never conflict with the host environment.
