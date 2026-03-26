# React Native vs React Web - Quick Guide

## 🎯 Key Differences

### 1. **Components** (Instead of HTML tags)

| React Web | React Native | Purpose |
|-----------|--------------|---------|
| `<div>` | `<View>` | Container element |
| `<span>`, `<p>`, `<h1>` | `<Text>` | Display text |
| `<button>` | `<TouchableOpacity>` or `<Pressable>` | Clickable element |
| `<input>` | `<TextInput>` | Text input field |
| `<img>` | `<Image>` | Display images |
| `<div style={{overflow: 'scroll'}}>` | `<ScrollView>` | Scrollable container |

### 2. **Styling** (No CSS files!)

#### React Web:
```jsx
// styles.css
.container {
  display: flex;
  background-color: blue;
  padding: 20px;
}

// Component
<div className="container">Hello</div>
```

#### React Native:
```jsx
import { StyleSheet, View, Text } from 'react-native';

// Inline object or StyleSheet
<View style={styles.container}>
  <Text>Hello</Text>
</View>

const styles = StyleSheet.create({
  container: {
    display: 'flex',        // Flexbox is DEFAULT (no need to declare!)
    backgroundColor: 'blue', // camelCase instead of kebab-case
    padding: 20,            // Numbers (not '20px')
  }
});
```

### 3. **Flexbox is EVERYWHERE** (Default Layout)

#### React Web:
```css
.container {
  display: flex;          /* Need to declare */
  flex-direction: row;    /* Default is row */
  justify-content: center;
}
```

#### React Native:
```jsx
const styles = StyleSheet.create({
  container: {
    // display: 'flex' is AUTOMATIC!
    flexDirection: 'column',    // Default is 'column' (not row!)
    justifyContent: 'center',   // Vertical alignment (in column)
    alignItems: 'center',       // Horizontal alignment (in column)
  }
});
```

### 4. **No px, rem, em - Just Numbers!**

```jsx
// ❌ Web way (DON'T do this in React Native)
padding: '20px'
fontSize: '1.5rem'

// ✅ React Native way
padding: 20        // Automatically scaled for device
fontSize: 18       // Automatically scaled for device
```

### 5. **Layout Examples**

#### Centered Card (Like your Auth Section)
```jsx
// Web equivalent:
// <div className="card-container">
//   <div className="card">Content</div>
// </div>

<View style={styles.cardContainer}>
  <View style={styles.card}>
    <Text>Content</Text>
  </View>
</View>

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    justifyContent: 'center',  // Vertical center
    alignItems: 'center',      // Horizontal center
    backgroundColor: '#E8B4A0',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '80%',             // Percentage works!
    // boxShadow in web → shadowColor, shadowOffset, etc.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,  // Android shadow
  }
});
```

#### Horizontal Row Layout
```jsx
// Two items side by side
<View style={styles.row}>
  <Text style={styles.icon}>📚</Text>
  <View style={styles.textContent}>
    <Text>Title</Text>
    <Text>Description</Text>
  </View>
</View>

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',      // Horizontal layout
    alignItems: 'center',      // Vertical alignment in row
    gap: 16,                   // Space between children
  },
  textContent: {
    flex: 1,                   // Take remaining space
  }
});
```

#### Full Height Container
```jsx
// Web: height: 100vh
// React Native:
container: {
  flex: 1,  // Takes all available space from parent
}
```

### 6. **Events** (Different Names)

| React Web | React Native |
|-----------|--------------|
| `onClick` | `onPress` |
| `onMouseEnter` | N/A (use `onPressIn`) |
| `onChange` | `onChangeText` (TextInput) |

```jsx
// Web
<button onClick={() => alert('Hi')}>Click</button>

// React Native
<TouchableOpacity onPress={() => alert('Hi')}>
  <Text>Click</Text>
</TouchableOpacity>
```

### 7. **Common Properties**

```jsx
const styles = StyleSheet.create({
  // SPACING
  margin: 10,           // All sides
  marginVertical: 10,   // Top & Bottom
  marginHorizontal: 20, // Left & Right
  padding: 15,
  paddingTop: 20,
  
  // SIZE
  width: 200,
  height: 100,
  width: '100%',        // Percentage
  
  // COLORS
  backgroundColor: '#E8B4A0',
  color: '#333',        // Text color (for Text component)
  
  // BORDERS
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#ccc',
  
  // POSITIONING
  position: 'absolute', // or 'relative'
  top: 0,
  left: 0,
  zIndex: 10,
  
  // TEXT (Only for Text component)
  fontSize: 16,
  fontWeight: 'bold',   // or '600'
  textAlign: 'center',
  color: '#333',
});
```

### 8. **Your Current Project Structure**

```
app/(tabs)/
  ├── index.tsx       ← Home screen (Parent/Teacher selection)
  ├── explore.tsx     ← Explore screen (Islamic learning features)
  └── _layout.tsx     ← Tab navigation setup

components/         ← Reusable components
constants/theme.ts  ← Colors, fonts, etc.
```

### 9. **Quick Tips**

1. **Always import from 'react-native'**
   ```jsx
   import { View, Text, StyleSheet } from 'react-native';
   ```

2. **Text MUST be in `<Text>` component**
   ```jsx
   ❌ <View>Hello</View>
   ✅ <View><Text>Hello</Text></View>
   ```

3. **Styles are objects, not strings**
   ```jsx
   ❌ style="background-color: blue"
   ✅ style={{ backgroundColor: 'blue' }}
   ✅ style={styles.container}
   ```

4. **Use ScrollView for scrollable content**
   ```jsx
   <ScrollView>
     {/* Long content here */}
   </ScrollView>
   ```

5. **Check the Expo docs!**
   - https://docs.expo.dev
   - https://reactnative.dev/docs/components-and-apis

---

## 🚀 Your IlmConnect App Components

### Home Screen Pattern (index.tsx)
- ScrollView (outer container)
  - View (content wrapper)
    - Text (title)
    - TouchableOpacity (interactive cards)
      - View (icon circle)
      - View (text content)

### Explore Screen Pattern (explore.tsx)
- ScrollView
  - View (hero section with gradient background)
    - Text (emoji icon)
    - View (auth card)
  - View (features section)
    - View (feature cards in a list)

Need help with anything specific? Just ask! 🎉
