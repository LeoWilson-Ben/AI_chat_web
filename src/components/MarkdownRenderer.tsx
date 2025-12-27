import React from 'react'
import { Copy, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'

interface MarkdownRendererProps {
  content: string
  className?: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const CodeBlock: React.FC<any> = ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '')
    const [copied, setCopied] = React.useState(false)
    const codeRef = React.useRef<HTMLElement | null>(null)

    const handleCopy = async () => {
      try {
        const text = codeRef.current?.innerText ?? (typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '')
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      } catch {
        try {
          const ta = document.createElement('textarea')
          const text = codeRef.current?.innerText ?? (typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '')
          ta.value = text
          ta.style.position = 'fixed'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.focus()
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {}
      }
    }

    return !inline && match ? (
      <div className="relative group">
        <pre className="bg-blue-50 text-gray-800 p-4 rounded-lg overflow-x-auto my-4">
          <code ref={codeRef as any} className={className} {...props}>
            {children}
          </code>
        </pre>
        <button
          onClick={handleCopy}
          title={copied ? '已复制' : '复制'}
          className="absolute top-2 right-2 p-1.5 rounded-md text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    ) : (
      <code 
        className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono" 
        {...props}
      >
        {children}
      </code>
    )
  }

  return (
    <div className={`markdown-content break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          code: CodeBlock,
          // 自定义标题样式
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-gray-900 mt-5 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-gray-900 mt-4 mb-2">{children}</h3>
          ),
          // 自定义段落
          p: ({ children }) => (
            <p className="text-base leading-relaxed text-gray-800 mb-4">{children}</p>
          ),
          // 自定义列表
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-800 mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-800 mb-4 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-800">{children}</li>
          ),
          // 自定义引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 my-4 text-gray-700 italic">
              {children}
            </blockquote>
          ),
          // 自定义表格
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-300 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white divide-y divide-gray-200">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {children}
            </td>
          ),
          // 自定义链接
          a: ({ children, href }) => (
            <a 
              href={href} 
              className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // 自定义删除线
          del: ({ children }) => (
            <del className="text-gray-500">{children}</del>
          ),
          // 自定义粗体和斜体
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer
