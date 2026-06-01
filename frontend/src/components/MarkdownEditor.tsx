import React, { useRef, useCallback, useState } from 'react';
import MDEditor, { commands, TextAreaTextApi } from '@uiw/react-md-editor';
import { ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  className?: string;
}


const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value = '',
  onChange,
  placeholder = '开始输入 Markdown...',
  height = 400,
  className,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const textApiRef = useRef<TextAreaTextApi | null>(null);

  // 上传图片到服务器
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      setUploadProgress('上传中...');

      const response = await fetch('/api/workspace', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('上传失败');
      }

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(data.message || '上传失败');
      }

      const filename = data.data?.filename || data.filename;
      if (!filename) {
        throw new Error('上传成功但未返回文件名');
      }

      const imageUrl = `/api/workspace/${filename}`;
      setUploadProgress('上传成功');
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress('');
      }, 1000);

      return imageUrl;
    } catch (error) {
      setUploadProgress('上传失败');
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress('');
      }, 2000);
      throw error;
    }
  }, []);

  // 在编辑器中插入图片
  const insertImage = useCallback(async (url: string, textApi: TextAreaTextApi) => {
    const imageMarkdown = `![image](${url})`;
    textApi.replaceSelection(imageMarkdown);
  }, []);

  // 处理图片上传
  const handleImageUpload = useCallback(async (file: File, textApi: TextAreaTextApi) => {
    try {
      const imageUrl = await uploadImage(file);
      await insertImage(imageUrl, textApi);
    } catch (error) {
      console.error('图片上传失败:', error);
      alert('图片上传失败，请重试');
    }
  }, [uploadImage, insertImage]);

  // 处理文件选择
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !textApiRef.current) return;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    await handleImageUpload(file, textApiRef.current);
    
    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleImageUpload]);

  // 触发文件选择
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 处理粘贴事件
  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items;
    let imageFile: File | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        imageFile = item.getAsFile();
        break;
      }
    }

    if (imageFile && textApiRef.current) {
      event.preventDefault();
      await handleImageUpload(imageFile, textApiRef.current);
    }
  }, [handleImageUpload]);

  // 自定义图片上传命令
  const imageUploadCommand: commands.ICommand = {
    name: 'image-upload',
    keyCommand: 'image-upload',
    buttonProps: { 'aria-label': '上传图片' },
    icon: (
      <div className="flex items-center justify-center w-5 h-5">
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ImageIcon className="w-4 h-4" />
        )}
      </div>
    ),
    execute: (state, api) => {
      if (!isUploading) {
        textApiRef.current = api;
        triggerFileSelect();
      }
    },
  };

  // 监听编辑器获取 textApi
  const handleEditorChange = useCallback((newValue: string | undefined) => {
    onChange?.(newValue || '');
  }, [onChange]);

  return (
    <div 
      className={cn('relative w-full', className)} 
      ref={editorRef}
      onPaste={handlePaste}
    >
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 上传状态提示 */}
      {isUploading && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--primary-500)' }} />
          <span>{uploadProgress}</span>
        </div>
      )}

      <MDEditor
        value={value}
        onChange={handleEditorChange}
        height={height}
        textareaProps={{
          placeholder,
        }}
        commands={[
          commands.bold,
          commands.italic,
          commands.strikethrough,
          commands.hr,
          commands.title,
          commands.divider,
          commands.link,
          imageUploadCommand,
          commands.quote,
          commands.code,
          commands.codeBlock,
          commands.unorderedListCommand,
          commands.orderedListCommand,
          commands.checkedListCommand,
          commands.divider,
          commands.table,
        ]}
        extraCommands={[
          commands.codePreview,
          commands.fullscreen,
        ]}
        preview="live"
        data-color-mode="dark"
      />

      <style>{`
        .w-md-editor {
          background-color: var(--bg-surface) !important;
          border: 1px solid var(--border-default) !important;
          border-radius: 0.5rem !important;
          box-shadow: none !important;
        }
        
        .w-md-editor-toolbar {
          background-color: var(--bg-surface-alt) !important;
          border-bottom: 1px solid var(--border-default) !important;
          border-radius: 0.5rem 0.5rem 0 0 !important;
        }
        
        .w-md-editor-toolbar ul > li > button {
          color: var(--text-secondary) !important;
          border-radius: 0.375rem !important;
          transition: all 0.2s ease !important;
        }
        
        .w-md-editor-toolbar ul > li > button:hover {
          background-color: var(--bg-muted) !important;
          color: var(--text-primary) !important;
        }
        
        .w-md-editor-toolbar ul > li > button.active {
          background-color: var(--primary-600) !important;
          color: white !important;
        }
        
        .w-md-editor-toolbar ul > li > button:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        
        .w-md-editor-toolbar-divider {
          background-color: var(--border-default) !important;
        }
        
        .w-md-editor-input {
          background-color: var(--bg-surface) !important;
        }
        
        .w-md-editor-text-pre > code,
        .w-md-editor-text-input {
          color: var(--text-primary) !important;
          background-color: transparent !important;
          font-family: var(--font-mono) !important;
          font-size: 14px !important;
          line-height: 1.6 !important;
        }
        
        .w-md-editor-text-pre > code {
          color: var(--text-secondary) !important;
        }
        
        .w-md-editor-text-input::placeholder {
          color: var(--text-muted) !important;
        }
        
        .w-md-editor-preview {
          background-color: var(--bg-surface) !important;
          border-left: 1px solid var(--border-default) !important;
        }
        
        .w-md-editor-preview .wmde-markdown {
          background-color: transparent !important;
          color: var(--text-primary) !important;
          font-family: var(--font-sans) !important;
        }
        
        .w-md-editor-preview .wmde-markdown h1,
        .w-md-editor-preview .wmde-markdown h2,
        .w-md-editor-preview .wmde-markdown h3,
        .w-md-editor-preview .wmde-markdown h4,
        .w-md-editor-preview .wmde-markdown h5,
        .w-md-editor-preview .wmde-markdown h6 {
          color: var(--text-primary) !important;
          border-bottom-color: var(--border-default) !important;
        }
        
        .w-md-editor-preview .wmde-markdown p {
          color: var(--text-secondary) !important;
        }
        
        .w-md-editor-preview .wmde-markdown a {
          color: var(--primary-500) !important;
        }
        
        .w-md-editor-preview .wmde-markdown a:hover {
          color: var(--primary-400) !important;
        }
        
        .w-md-editor-preview .wmde-markdown code {
          background-color: var(--bg-muted) !important;
          color: var(--text-primary) !important;
          font-family: var(--font-mono) !important;
        }
        
        .w-md-editor-preview .wmde-markdown pre {
          background-color: var(--bg-muted) !important;
          border: 1px solid var(--border-default) !important;
          border-radius: 0.375rem !important;
        }
        
        .w-md-editor-preview .wmde-markdown pre code {
          background-color: transparent !important;
        }
        
        .w-md-editor-preview .wmde-markdown blockquote {
          border-left-color: var(--primary-500) !important;
          background-color: var(--bg-muted) !important;
          color: var(--text-secondary) !important;
        }
        
        .w-md-editor-preview .wmde-markdown table {
          border-color: var(--border-default) !important;
        }
        
        .w-md-editor-preview .wmde-markdown th,
        .w-md-editor-preview .wmde-markdown td {
          border-color: var(--border-default) !important;
          background-color: var(--bg-surface) !important;
        }
        
        .w-md-editor-preview .wmde-markdown th {
          background-color: var(--bg-muted) !important;
        }
        
        .w-md-editor-preview .wmde-markdown hr {
          background-color: var(--border-default) !important;
        }
        
        .w-md-editor-preview .wmde-markdown img {
          border-radius: 0.375rem !important;
          max-width: 100% !important;
        }
        
        .w-md-editor-preview .wmde-markdown ul,
        .w-md-editor-preview .wmde-markdown ol {
          color: var(--text-secondary) !important;
        }
        
        .w-md-editor-preview .wmde-markdown li::marker {
          color: var(--primary-500) !important;
        }
        
        /* 滚动条样式 */
        .w-md-editor-input::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .w-md-editor-input::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .w-md-editor-input::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        
        .w-md-editor-input::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
          background-clip: content-box;
        }
        
        .w-md-editor-preview::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .w-md-editor-preview::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .w-md-editor-preview::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        
        .w-md-editor-preview::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
          background-clip: content-box;
        }
        
        /* 全屏模式 */
        .w-md-editor.w-md-editor-fullscreen {
          background-color: var(--bg-base) !important;
          z-index: 9999 !important;
        }
        
        .w-md-editor.w-md-editor-fullscreen .w-md-editor-toolbar {
          background-color: var(--bg-surface) !important;
        }
      `}</style>
    </div>
  );
};

export default MarkdownEditor;
