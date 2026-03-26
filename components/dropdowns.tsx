import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, Country as PhoneCountry } from '@/components/phone-input';

// Try to load the `country-state-city` package at runtime. If not installed, fall back
// to the smaller built-in lists. This keeps the app working until you `npm install` the
// full dataset in the ILm project.
let CSC: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  CSC = require('country-state-city');
} catch (e) {
  CSC = null;
}

// Helper: convert ISO alpha-2 code to emoji flag (works for all countries)
function isoToFlag(iso?: string) {
  if (!iso) return '';
  try {
    // Regional indicator symbols: A -> 0x1F1E6
    return iso
      .toUpperCase()
      .split('')
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join('');
  } catch (e) {
    return '';
  }
}

// Build library countries with flags computed from ISO; fall back to phone list names if needed
const LIB_COUNTRIES = CSC && CSC.Country && typeof CSC.Country.getAllCountries === 'function'
  ? CSC.Country.getAllCountries().map((c: any) => ({ code: c.isoCode, name: c.name, flag: isoToFlag(c.isoCode) }))
  : null;

// ISO-639-1 language codes. Rendered with Intl.DisplayNames for world coverage.
const LANGUAGE_CODES = [
  'aa','ab','ae','af','ak','am','an','ar','as','av','ay','az','ba','be','bg','bh','bi','bm','bn','bo','br','bs',
  'ca','ce','ch','co','cr','cs','cu','cv','cy','da','de','dv','dz','ee','el','en','eo','es','et','eu','fa','ff',
  'fi','fj','fo','fr','fy','ga','gd','gl','gn','gu','gv','ha','he','hi','ho','hr','ht','hu','hy','hz','ia','id',
  'ie','ig','ii','ik','io','is','it','iu','ja','jv','ka','kg','ki','kj','kk','kl','km','kn','ko','kr','ks','ku',
  'kv','kw','ky','la','lb','lg','li','ln','lo','lt','lu','lv','mg','mh','mi','mk','ml','mn','mr','ms','mt','my',
  'na','nb','nd','ne','ng','nl','nn','no','nr','nv','ny','oc','oj','om','or','os','pa','pi','pl','ps','pt','qu',
  'rm','rn','ro','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sq','sr','ss','st','su','sv',
  'sw','ta','te','tg','th','ti','tk','tl','tn','to','tr','ts','tt','tw','ty','ug','uk','ur','uz','ve','vi','vo',
  'wa','wo','xh','yi','yo','za','zh','zu'
];

const languageDisplay = typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined'
  ? new Intl.DisplayNames(['en'], { type: 'language' })
  : null;

export const WORLD_LANGUAGE_OPTIONS: string[] = Array.from(
  new Set(
    LANGUAGE_CODES
      .map((code) => {
        try {
          const label = languageDisplay?.of(code);
          if (!label || label.toLowerCase() === code.toLowerCase()) return null;
          return label;
        } catch (e) {
          return null;
        }
      })
      .filter((v): v is string => Boolean(v))
  )
).sort((a, b) => a.localeCompare(b));

const parseLanguages = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const buildLanguageSummary = (selected: string[]) => {
  if (selected.length === 0) return 'Select languages';
  if (selected.length <= 2) return selected.join(', ');
  return `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`;
};

export function CountryDropdown({ value, onSelect, label, required }: { value?: string; onSelect: (c: string) => void; label?: string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Use library countries if available, otherwise fall back to our phone list
  const source = LIB_COUNTRIES || COUNTRIES.map(c => ({ code: c.code, name: c.name, flag: c.flag }));

  const filtered = useMemo(() => {
    if (!query) return source;
    const q = query.toLowerCase();
    return source.filter((c: any) => c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q));
  }, [query, source]);

  return (
    <View style={styles.fieldContainer}>
      {label && (
        <ThemedText style={styles.label}>{label} {required && <ThemedText style={styles.required}>*</ThemedText>}</ThemedText>
      )}
      <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <ThemedText style={styles.selectorText}>{value || 'Select country'}</ThemedText>
        <Ionicons name="chevron-down" size={18} color="#666" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
        <View style={styles.modal}> 
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select country</ThemedText>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search country..." placeholderTextColor="#999" />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList data={filtered} keyExtractor={(i: any) => i.code || i.name} renderItem={({ item }) => (
            <TouchableOpacity style={styles.countryItem} onPress={() => { onSelect(item.name); setOpen(false); }}>
              <ThemedText style={styles.flag}>{item.flag}</ThemedText>
              <View style={{flex:1}}>
                <ThemedText style={styles.countryName}>{item.name}</ThemedText>
              </View>
            </TouchableOpacity>
          )} />
        </View>
      </Modal>
    </View>
  );
}

// NOTE: We do not keep a hardcoded global city list. A minimal empty fallback
// is kept so the UI handles the no-data case gracefully; the authoritative
// city lists must come from `country-state-city` or an external API in
// production (installed as `country-state-city`).
const CITY_MAP: Record<string, string[]> = {};

export function CityDropdown({ country, value, onSelect, label, required }: { country?: string; value?: string; onSelect: (c: string) => void; label?: string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Resolve country -> isoCode using library countries if available, otherwise match by name in PHONE list
  const countryIso = useMemo(() => {
    if (!country) return null;
    if (LIB_COUNTRIES) {
      const found = LIB_COUNTRIES.find((c: any) => c.name.toLowerCase() === country.toLowerCase());
      return found ? found.code : null;
    }
    const found = (COUNTRIES || []).find(c => c.name.toLowerCase() === country.toLowerCase());
    return found ? found.code : null;
  }, [country]);

  const cities: string[] = useMemo(() => {
    if (!country) return [];
    if (CSC && countryIso && CSC.City && typeof CSC.City.getCitiesOfCountry === 'function') {
      try {
        const list = CSC.City.getCitiesOfCountry(countryIso) || [];
        // ensure unique and just names
        return Array.from(new Set(list.map((c: any) => c.name))).sort();
      } catch (e) {
        return CITY_MAP[country] || [];
      }
    }
    return CITY_MAP[country] || [];
  }, [country, countryIso]);

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((city) => city.toLowerCase().includes(q));
  }, [cities, query]);

  return (
    <View style={styles.fieldContainer}>
      {label && (
        <ThemedText style={styles.label}>{label} {required && <ThemedText style={styles.required}>*</ThemedText>}</ThemedText>
      )}
      <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <ThemedText style={styles.selectorText}>{value || (country ? 'Select city' : 'Select country first')}</ThemedText>
        <Ionicons name="chevron-down" size={18} color="#666" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select city</ThemedText>
            <TouchableOpacity onPress={() => { setQuery(''); setOpen(false); }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search city..."
              placeholderTextColor="#999"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList data={filteredCities} keyExtractor={(i) => i} renderItem={({ item }) => (
            <TouchableOpacity style={styles.countryItem} onPress={() => { onSelect(item); setOpen(false); }}>
              <ThemedText style={styles.countryName}>{item}</ThemedText>
            </TouchableOpacity>
          )} ListEmptyComponent={<View style={{padding:20}}><ThemedText style={{color:'#999'}}>{country ? 'No cities found' : 'No cities available'}</ThemedText></View>} />
        </View>
      </Modal>
    </View>
  );
}

export function GenderDropdown({ value, onSelect, label, required }: { value?: string; onSelect: (v: string) => void; label?: string; required?: boolean }) {
  const options = ['Male', 'Female', 'Other'];
  return (
    <View style={styles.fieldContainer}>
      {label && (<ThemedText style={styles.label}>{label} {required && <ThemedText style={styles.required}>*</ThemedText>}</ThemedText>)}
      <View style={styles.selectorRow}>
        {options.map(opt => (
          <TouchableOpacity key={opt} style={[styles.pill, value === opt && styles.pillActive]} onPress={() => onSelect(opt)}>
            <ThemedText style={[styles.pillText, value === opt && styles.pillTextActive]}>{opt}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function LanguagesDropdown({ value, onSelect, label, required }: { value?: string; onSelect: (v: string) => void; label?: string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = parseLanguages(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WORLD_LANGUAGE_OPTIONS;
    return WORLD_LANGUAGE_OPTIONS.filter((lang) => lang.toLowerCase().includes(q));
  }, [query]);

  const toggle = (language: string) => {
    const set = new Set(selected);
    if (set.has(language)) set.delete(language);
    else set.add(language);
    onSelect(Array.from(set).sort((a, b) => a.localeCompare(b)).join(', '));
  };

  return (
    <View style={styles.fieldContainer}>
      {label && (<ThemedText style={styles.label}>{label} {required && <ThemedText style={styles.required}>*</ThemedText>}</ThemedText>)}
      <TouchableOpacity style={styles.selector} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <ThemedText style={styles.selectorText}>{buildLanguageSummary(selected)}</ThemedText>
        <Ionicons name="chevron-down" size={18} color="#666" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select languages</ThemedText>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search language..."
              placeholderTextColor="#999"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = selected.includes(item);
              return (
                <TouchableOpacity style={styles.countryItem} onPress={() => toggle(item)}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.countryName}>{item}</ThemedText>
                  </View>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? '#4ECDC4' : '#B0B0B0'}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

export function LanguagesMultiSelectDropdown({
  values,
  onChange,
  label,
  required,
}: {
  values?: string[];
  onChange: (v: string[]) => void;
  label?: string;
  required?: boolean;
}) {
  const value = (values || []).join(', ');
  return (
    <LanguagesDropdown
      value={value}
      onSelect={(next) => onChange(parseLanguages(next))}
      label={label}
      required={required}
    />
  );
}

const styles = StyleSheet.create({
  fieldContainer: { gap: 8, marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  required: { color: '#FF6B6B' },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: '#F8FAFB', borderWidth: 1, borderColor: '#E8E8E8' },
  selectorText: { color: '#333' },
  modal: { flex: 1, paddingTop: Platform.OS === 'ios' ? 44 : 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, margin: 12, borderRadius: 12, backgroundColor: '#F5F5F5' },
  searchInput: { flex: 1, paddingVertical: 8, color: '#333' },
  countryItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F3F3' },
  flag: { fontSize: 26, marginRight: 12 },
  countryName: { fontSize: 16, color: '#333' },
  countryCode: { fontSize: 13, color: '#666' },
  selectorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E8E8' },
  pillActive: { backgroundColor: '#4ECDC4', borderColor: '#4ECDC4' },
  pillText: { color: '#333' },
  pillTextActive: { color: '#fff' },
});

// No default export; module provides named dropdowns.
