// Example theme: theme.css paints with --example-accent; this sets it from
// the plugin's setting and follows changes made in Settings.
const ACCENTS = { red: '#ff0033', teal: '#1de9b6', gold: '#ffc400' };

let removeAccent = null;

function applyAccent(values) {
  if (removeAccent) removeAccent();
  const color = ACCENTS[values.accent] || ACCENTS.red;
  removeAccent = oxitune.ui.addStyle(`html { --example-accent: ${color}; }`);
}

applyAccent(oxitune.settings.all());
oxitune.settings.onChange(applyAccent);
oxitune.onUnload(() => removeAccent && removeAccent());
