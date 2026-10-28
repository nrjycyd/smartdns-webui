'use client';

import * as React from 'react';
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, Divider, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { EMPTY_GROUP_APPEARANCES, getGroupAppearance, isGroupIconName, joinThemeColors, mergeGroupAppearances, parseGroupOverrides, serializeGroupOverrides, setGroupOverride, splitThemeColor, type GroupAppearanceField, type GroupAppearances } from '@/components/dashboard/query-log/group-appearance';
import { GroupLabel, useGroupAppearance } from '@/components/dashboard/query-log/group-label';
import groupIcons from '@/components/dashboard/query-log/group-icons.json';

function isColor(value: string): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('color', value);
}

function validateOverrides(overrides: GroupAppearances, defaults: GroupAppearances): string | undefined {
  const effective = mergeGroupAppearances(defaults, overrides);
  for (const [name, rule] of Object.entries(overrides)) {
    if (rule.icon && !isGroupIconName(rule.icon.trim())) return name;
    if (rule.color && !isColor(rule.color)) return name;
    if (getGroupAppearance(effective, name)?.icon && rule.iconColor && !isColor(rule.iconColor)) return name;
  }
  return undefined;
}

interface ColorRuleProps {
  label: string;
  value: string | undefined;
  fallback: string | undefined;
  emptyLabel: string;
  disabled?: boolean;
  onChange: (value: string | undefined) => void;
}

function ColorRuleEditor({ label, value, fallback, emptyLabel, disabled, onChange }: ColorRuleProps): React.JSX.Element {
  const { t } = useTranslation();
  const mode = value === undefined ? 'file' : value === '' ? 'empty' : 'custom';
  const [light, dark] = splitThemeColor(value || fallback || '#1976d2');

  function colorField(scheme: 'light' | 'dark', color: string): React.JSX.Element {
    const fieldLabel = `${label} · ${t(scheme === 'light' ? 'Light theme' : 'Dark theme')}`;
    const update = (next: string) => { onChange(scheme === 'light' ? joinThemeColors(next, dark) : joinThemeColors(light, next)); };
    return (
      <TextField
        fullWidth label={fieldLabel} value={color} disabled={disabled}
        onChange={(event) => { update(event.target.value); }}
        error={!isColor(color)} helperText={isColor(color) ? undefined : t('Enter a valid color.')}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><input type="color" aria-label={`${t('Choose color')}: ${fieldLabel}`} value={/^#[\da-f]{6}$/i.test(color) ? color : '#000000'} onChange={(event) => { update(event.target.value); }} disabled={disabled} style={{ width: 26, height: 26, padding: 0, border: 0, cursor: 'pointer', background: 'none' }} /></InputAdornment> } }}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <TextField select fullWidth label={label} value={mode} disabled={disabled} onChange={(event) => { onChange(event.target.value === 'file' ? undefined : event.target.value === 'empty' ? '' : fallback || '#1976d2'); }}>
        <MenuItem value="file">{t('Use file default')}</MenuItem>
        <MenuItem value="empty">{emptyLabel}</MenuItem>
        <MenuItem value="custom">{t('Custom')}</MenuItem>
      </TextField>
      {mode === 'custom' && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>{colorField('light', light)}{colorField('dark', dark)}</Stack>}
    </Stack>
  );
}

function GroupAppearanceEditor(): React.JSX.Element {
  const { t } = useTranslation();
  const { defaults, overrides, knownGroups, storageError, save, refresh } = useGroupAppearance();
  const [draft, setDraft] = React.useState(overrides);
  const [baseline, setBaseline] = React.useState(overrides);
  const [selected, setSelected] = React.useState(Object.keys(defaults)[0] || Object.keys(overrides)[0] || 'default');
  const [editingIcon, setEditingIcon] = React.useState(false);
  const [message, setMessage] = React.useState<{ severity: 'success' | 'info' | 'error'; text: string } | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const dirty = serializeGroupOverrides(draft) !== serializeGroupOverrides(baseline);
  const externalChange = serializeGroupOverrides(overrides) !== serializeGroupOverrides(baseline);

  React.useEffect(() => {
    if (!dirty && externalChange) {
      setDraft(overrides);
      setBaseline(overrides);
    }
  }, [dirty, externalChange, overrides]);

  const merged = React.useMemo(() => mergeGroupAppearances(defaults, draft), [defaults, draft]);
  const errorGroup = validateOverrides(draft, defaults);
  const names = [...new Set([...Object.keys(defaults), ...Object.keys(draft), ...knownGroups, selected, 'default'])].toSorted();
  const rule = getGroupAppearance(draft, selected) ?? {};
  const fileDefault = getGroupAppearance(defaults, selected);
  const effective = getGroupAppearance(merged, selected);
  const iconMode = editingIcon ? 'custom' : rule.icon === undefined ? 'file' : rule.icon === '' ? 'empty' : 'custom';

  function change(field: GroupAppearanceField, value: string | undefined) {
    setDraft((previous) => setGroupOverride(previous, selected, field, value));
    setMessage(null);
  }

  function saveChanges() {
    if (errorGroup) return;
    const normalized = parseGroupOverrides(serializeGroupOverrides(draft));
    if (save(normalized)) {
      setDraft(normalized);
      setBaseline(normalized);
      setEditingIcon(false);
      setMessage({ severity: 'success', text: t('Group appearance saved in this browser.') });
    } else setMessage({ severity: 'error', text: t('Could not save local settings. Check browser storage permissions.') });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('File too large');
      const next = parseGroupOverrides(await file.text());
      if (validateOverrides(next, defaults)) throw new Error('Invalid appearance');
      setDraft(next);
      setSelected(Object.keys(next)[0] || Object.keys(defaults)[0] || 'default');
      setEditingIcon(false);
      setMessage({ severity: 'info', text: t('Custom settings imported. Review the preview and save.') });
    } catch {
      setMessage({ severity: 'error', text: t('Could not import settings. Choose a valid group appearance JSON file under 1 MB.') });
    }
  }

  function exportFile() {
    const url = URL.createObjectURL(new Blob([serializeGroupOverrides(draft)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smartdns-group-appearance.json';
    link.click();
    setTimeout(() => { URL.revokeObjectURL(url); }, 0);
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 920 }}>
      <Stack spacing={1}>
        <Typography variant="h6">{t('Group appearance')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('Appearance settings are saved in this browser.')}</Typography>
      </Stack>
      {storageError && message?.severity !== 'error' && <Alert severity="warning">{t('Local settings could not be read or saved. Check browser storage permissions.')}</Alert>}
      {externalChange && dirty && <Alert severity="info">{t('Settings changed in another window. Cancel to load them, or save your current edits.')}</Alert>}
      {message && <Alert severity={message.severity}>{message.text}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
        <Autocomplete
          freeSolo fullWidth options={names} value={selected}
          onChange={(_event, value) => { if (value?.trim()) { setSelected(value.trim()); setEditingIcon(false); setMessage(null); } }}
          renderInput={(params) => <TextField {...params} label={t('Group')} helperText={t('Choose or enter a group name; appearance only.')} />}
        />
        <Chip label={t(Object.keys(rule).length > 0 ? 'Custom' : 'Default')} color={Object.keys(rule).length > 0 ? 'primary' : 'default'} size="small" variant="outlined" sx={{ mt: { sm: '16px !important' }, alignSelf: 'flex-start' }} />
      </Stack>
      <ColorRuleEditor label={t('Text color')} value={rule.color} fallback={fileDefault?.color} emptyLabel={t('Theme default text color')} onChange={(value) => { change('color', value); }} />
      <Stack spacing={2}>
        <TextField select fullWidth label={t('Group icon')} value={iconMode} onChange={(event) => { setEditingIcon(event.target.value === 'custom'); change('icon', event.target.value === 'file' ? undefined : event.target.value === 'empty' ? '' : effective?.icon || 'keyline-icons:shield-off-duotone'); }}>
          <MenuItem value="file">{t('Use file default')}</MenuItem>
          <MenuItem value="empty">{t('No icon')}</MenuItem>
          <MenuItem value="custom">{t('Custom')}</MenuItem>
        </TextField>
        {iconMode === 'custom' && <Autocomplete freeSolo options={Object.keys(groupIcons)} value={rule.icon || null} inputValue={rule.icon || ''} onChange={(_event, value) => { change('icon', value || ''); }} onInputChange={(_event, value, reason) => { if (reason === 'input' || reason === 'clear') change('icon', value); }} renderInput={(params) => <TextField {...params} label={t('Iconify icon name')} error={Boolean(rule.icon && !isGroupIconName(rule.icon.trim()))} helperText={rule.icon && !isGroupIconName(rule.icon.trim()) ? t('Enter an icon name such as keyline-icons:shield-off-duotone.') : t('Custom icons require internet access.')} />} />}
      </Stack>
      <ColorRuleEditor label={t('Icon color')} value={rule.iconColor} fallback={fileDefault?.iconColor || effective?.color} emptyLabel={t('Follow text color')} disabled={!effective?.icon} onChange={(value) => { change('iconColor', value); }} />
      <Stack spacing={1}>
        <Typography variant="subtitle2">{t('Live preview')}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {(['light', 'dark'] as const).map((scheme) => (
            <Box key={scheme} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, bgcolor: scheme === 'light' ? '#ffffff' : '#121212', color: scheme === 'light' ? '#212121' : '#eeeeee' }}>
              <Typography variant="caption" component="div" sx={{ mb: 1, opacity: 0.7 }}>{t(scheme === 'light' ? 'Light theme' : 'Dark theme')}</Typography>
              <Box sx={{ fontSize: 14, minHeight: 24 }}><GroupLabel group={selected} groups={merged} scheme={scheme} /></Box>
            </Box>
          ))}
        </Box>
      </Stack>
      {errorGroup !== undefined && <Alert severity="error">{t('Check the color or icon settings for {{group}} before saving.', { group: errorGroup })}</Alert>}
      <Divider />
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button variant="contained" disabled={!dirty || errorGroup !== undefined} onClick={saveChanges}>{t('Save changes')}</Button>
        <Button variant="outlined" disabled={!dirty && !externalChange} onClick={() => { setDraft(overrides); setBaseline(overrides); setEditingIcon(false); setMessage(null); }}>{t('Cancel')}</Button>
        <Button disabled={Object.keys(rule).length === 0} onClick={() => { setDraft((previous) => { const next = { ...previous }; delete next[selected]; return next; }); setEditingIcon(false); setMessage(null); }}>{t('Reset this group')}</Button>
      </Stack>
      {dirty && <Typography variant="body2" color="text.secondary">{t('Preview changes are not saved yet.')}</Typography>}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button onClick={refresh}>{t('Reload file defaults')}</Button>
        <Button disabled={Object.keys(draft).length === 0} onClick={() => { setDraft(EMPTY_GROUP_APPEARANCES); setEditingIcon(false); setMessage(null); }}>{t('Reset all custom settings')}</Button>
        <Button onClick={() => { fileInput.current?.click(); }}>{t('Import custom settings')}</Button>
        <Button disabled={errorGroup !== undefined} onClick={exportFile}>{t('Export custom settings')}</Button>
      </Stack>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
    </Stack>
  );
}

export function GroupAppearanceSettings(): React.JSX.Element {
  const { ready } = useGroupAppearance();
  return ready ? <GroupAppearanceEditor /> : <CircularProgress size={24} />;
}
