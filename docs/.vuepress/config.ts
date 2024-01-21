import { defineUserConfig } from 'vuepress'
import { defaultTheme } from 'vuepress'
import { searchProPlugin } from "vuepress-plugin-search-pro";
import { mdEnhancePlugin } from 'vuepress-plugin-md-enhance';
import markdownItDeflist from 'markdown-it-deflist';
import { commentPlugin } from "vuepress-plugin-comment2";

export default defineUserConfig({
  host: 'localhost',
  lang: 'en-US',
  title: 'Fusion OS',
  description: 'Building a 64-bit operating system from scratch in Nim',
  theme: defaultTheme({
    sidebar: [
      '/osdev/01-intro.md',
      '/osdev/02-environment-setup.md',
      '/osdev/03-targeting-uefi-p1.md',
      '/osdev/04-targeting-uefi-p2.md',
      '/osdev/05-bootloader-p1.md',
      '/osdev/06-bootloader-p2.md',
      '/osdev/07-kernel-image.md',
      '/osdev/08-loading-the-kernel-p1.md',
      '/osdev/09-loading-the-kernel-p2.md',
      '/osdev/10-loading-the-kernel-p3.md',
      '/osdev/11-physical-memory.md',
      '/osdev/12-virtual-memory.md',
      '/osdev/13-higher-half-kernel.md',
      '/osdev/14-memory-segments.md',
      '/osdev/15-interrupts.md',
      '/osdev/16-user-mode.md',
      '/osdev/17-tss.md',
      '/osdev/18-system-calls.md',
      '/osdev/19-tasks.md',
      '/osdev/20-pie.md',
    ],
    contributors: false,
  }),
  markdown: {
    emoji: false
  },
  plugins: [
    searchProPlugin({
      indexContent: true,
    }),
    mdEnhancePlugin({
    }),
    commentPlugin({
      provider: "Giscus",
      repo: "khaledh/fusion",
      repoId: "R_kgDOKv64lg",
      category: "Blog Comments",
      categoryId: "DIC_kwDOKv64ls4CbG37",
    }),
  ],
  extendsMarkdown: (md) => {
    md.use(markdownItDeflist)
  },
})
