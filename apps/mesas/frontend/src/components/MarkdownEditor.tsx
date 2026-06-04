import { useEffect, useRef } from 'react';
import MarkdownIt from 'markdown-it';
import MdEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  height?: number;
  id?: string;
}

const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export const MarkdownEditor = ({ 
  value, 
  onChange, 
  placeholder = 'Digite aqui...', 
  height = 400
}: MarkdownEditorProps) => {
  const editorRef = useRef<InstanceType<typeof MdEditor> | null>(null);

  useEffect(() => {
    // Sincronizar valor externo com editor
    if (editorRef.current && editorRef.current.getMdValue() !== value) {
      editorRef.current.setText(value || '');
    }
  }, [value]);

  const handleEditorChange = ({ text }: { text: string }) => {
    onChange(text);
  };

  return (
    <div className="markdown-editor-wrapper">
      <MdEditor
        ref={editorRef}
        value={value || ''}
        style={{ height: `${height}px` }}
        renderHTML={(text) => mdParser.render(text)}
        onChange={handleEditorChange}
        placeholder={placeholder}
        view={{ menu: true, md: true, html: false }}
        canView={{ menu: true, md: true, html: true, both: true, fullScreen: true, hideMenu: true }}
        config={{
          view: {
            menu: true,
            md: true,
            html: false,
          },
          table: {
            maxRow: 10,
            maxCol: 10,
          },
          imageUrl: '',
          syncScrollMode: ['leftFollowRight', 'rightFollowLeft'],
        }}
        plugins={[
          'header',
          'font-bold',
          'font-italic',
          'font-underline',
          'font-strikethrough',
          'list-unordered',
          'list-ordered',
          'block-quote',
          'block-wrap',
          'block-code-inline',
          'block-code-block',
          'table',
          'link',
          'clear',
          'logger',
          'mode-toggle',
          'full-screen',
        ]}
      />
      <style>{`
        .markdown-editor-wrapper {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.05);
        }
        
        .rc-md-editor {
          background: transparent;
          border: none;
        }
        
        .rc-md-editor .editor-container {
          background: rgba(0, 0, 0, 0.2);
        }

        .rc-md-editor .section-container,
        .rc-md-editor .sec-md,
        .rc-md-editor .sec-md .input {
          background: #0f1a2e !important;
          color: rgba(255, 255, 255, 0.92) !important;
        }
        
        .rc-md-editor .editor-container > section {
          background: transparent;
          color: white;
        }
        
        .rc-md-editor .custom-html-style {
          background: rgba(0, 0, 0, 0.3);
          color: white;
          padding: 1rem;
        }
        
        .rc-md-editor .custom-html-style h1,
        .rc-md-editor .custom-html-style h2,
        .rc-md-editor .custom-html-style h3 {
          color: var(--color-artificio-orange);
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        
        .rc-md-editor .custom-html-style a {
          color: var(--color-artificio-orange);
          text-decoration: underline;
        }
        
        .rc-md-editor .custom-html-style code {
          background: rgba(255, 255, 255, 0.1);
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
        }
        
        .rc-md-editor .custom-html-style pre {
          background: rgba(0, 0, 0, 0.5);
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
        }
        
        .rc-md-editor .custom-html-style blockquote {
          border-left: 4px solid var(--color-artificio-orange);
          padding-left: 1rem;
          margin-left: 0;
          color: rgba(255, 255, 255, 0.8);
        }
        
        .rc-md-editor .tool-bar {
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .rc-md-editor .tool-bar .button {
          color: white;
        }
        
        .rc-md-editor .tool-bar .button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-artificio-orange);
        }
        
        .rc-md-editor textarea {
          color: white !important;
          background: #0f1a2e !important;
          caret-color: var(--color-artificio-orange);
          font-family: 'Courier New', monospace;
          font-size: 14px;
          line-height: 1.6;
        }

        .rc-md-editor textarea::selection,
        .rc-md-editor .sec-md .input::selection {
          background: rgba(245, 130, 32, 0.35);
          color: white;
        }
        
        .rc-md-editor textarea::placeholder {
          color: rgba(255, 255, 255, 0.4) !important;
          opacity: 1 !important;
        }
        
        .rc-md-editor .sec-md .input {
          -webkit-text-fill-color: rgba(255, 255, 255, 0.92);
        }
        
        .rc-md-editor .section-container input::placeholder,
        .rc-md-editor .section-container textarea::placeholder {
          color: rgba(255, 255, 255, 0.4) !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};
