import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, StandardSQL } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTheme } from '../context/ThemeContext';

export default function CqlEditor({ value, onChange, height = '200px', placeholder = '' }) {
  const { theme } = useTheme();

  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    // system
    return typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  }, [theme]);

  const extensions = useMemo(
    () => [
      sql({ dialect: StandardSQL }),
      EditorView.lineWrapping,
    ],
    []
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      height={height}
      extensions={extensions}
      theme={isDark ? oneDark : 'light'}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightSpecialChars: true,
        foldGutter: true,
        drawSelection: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        rectangularSelection: true,
        crosshairCursor: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
      }}
      placeholder={placeholder}
      style={{
        fontSize: '13px',
        fontFamily: 'JetBrains Mono, Fira Code, Menlo, monospace',
        direction: 'ltr',
      }}
    />
  );
}