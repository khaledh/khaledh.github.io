import { viteBundler } from '@vuepress/bundler-vite'
import { defineUserConfig } from 'vuepress'
import { defaultTheme } from '@vuepress/theme-default'
// import { searchPlugin } from '@vuepress/plugin-search'
import { searchProPlugin } from "vuepress-plugin-search-pro"
// import { mdEnhancePlugin } from 'vuepress-plugin-md-enhance'
import { commentPlugin } from '@vuepress/plugin-comment'
import { markdownImagePlugin } from '@vuepress/plugin-markdown-image'
import markdownItDeflist from 'markdown-it-deflist'

export default defineUserConfig({
  host: 'localhost',
  lang: 'en-US',
  title: 'Khaled Hammouda',
  description: 'Building a 64-bit operating system from scratch in Nim',
  theme: defaultTheme({
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Fusion OS', link: '/osdev/' },
      { text: 'NimJet', link: '/nimjet/' },
//    { text: 'Nim', link: '/nim/' },
    ],
    sidebar: {
      '/osdev/': [
        {
          text: 'Fusion OS',
          link: '/osdev/',
          children: [
            '01-intro.md',
            '02-environment-setup.md',
            '03-targeting-uefi-p1.md',
            '04-targeting-uefi-p2.md',
            '05-bootloader-p1.md',
            '06-bootloader-p2.md',
            '07-kernel-image.md',
            '08-loading-the-kernel-p1.md',
            '09-loading-the-kernel-p2.md',
            '10-loading-the-kernel-p3.md',
            '11-physical-memory.md',
            '12-virtual-memory.md',
            '13-higher-half-kernel.md',
            '14-memory-segments.md',
            '15-interrupts.md',
            '16-user-mode.md',
            '17-tss.md',
            '18-system-calls.md',
            '19-tasks.md',
            '20-position-independent-code.md',
            '21-elf-loader-p1.md',
            '22-elf-loader-p2.md',
            '23-coop-multitasking.md',
            '24-system-library.md',
          ],
        },
      ],
      '/nimjet/': [
        {
          text: 'NimJet',
          link: '/nimjet/',
          children: [
            '01-intro.md',
            '02-setup.md',
            '03-filetype.md',
            '04-lexer.md',
            '05-parser.md',
            '06-parser-p2.md',
            '07-grammarkit.md',
            '08-go-to-decl.md',
            '09-scopes.md',
            '10-rename-refactoring.md',
            '11-indentation.md',
            '12-decl-sections.md',
            '13-comments.md',
            '14-numeric-lit.md',
          ],
        }
      ],
      '/nim/': [
        {
          text: 'Nim',
          children: [
            '01-mm.md',
          ],
        }
      ],
    },
    contributors: false,
    themePlugins: {
      prismjs: {
        theme: 'tomorrow',
        notationWordHighlight: true,
        notationFocus: true,
        notationDiff: true,
        whitespace: true,
      },
    },
  }),
  markdown: {
    emoji: false
  },
  plugins: [
    searchProPlugin({
      indexContent: true,
    }),
//     mdEnhancePlugin({
//     }),
//     commentPlugin({
//       provider: "Giscus",
//       repo: "khaledh/fusion",
//       repoId: "R_kgDOKv64lg",
//       category: "Blog Comments",
//       categoryId: "DIC_kwDOKv64ls4CbG37",
//     }),
    commentPlugin({
    }),
    markdownImagePlugin({
      size: true,
    }),
],
  extendsMarkdown: (md) => {
    md.use(markdownItDeflist)
  },
  bundler: viteBundler({
    viteOptions: {},
    vuePluginOptions: {},
  }),
})
