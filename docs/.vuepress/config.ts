import { defineUserConfig } from 'vuepress'
import { defaultTheme } from 'vuepress'
import { searchProPlugin } from "vuepress-plugin-search-pro";
import { mdEnhancePlugin } from 'vuepress-plugin-md-enhance';
import markdownItDeflist from 'markdown-it-deflist';
import { commentPlugin } from "vuepress-plugin-comment2";

export default defineUserConfig({
  host: 'localhost',
  lang: 'en-US',
  title: '0xc0ffee',
  description: 'Khaled Hammouda\'s blog',
  theme: defaultTheme({
    sidebar: [
      '/osdev/01-intro.md',
      '/osdev/02-environment-setup.md',
      '/osdev/03-targeting-uefi-p1.md',
      '/osdev/04-targeting-uefi-p2.md',
      '/osdev/05-bootloader-p1.md',
      '/osdev/06-bootloader-p2.md',
      '/osdev/07-kernel-image.md',
      '/osdev/08-bootloader-p3.md',
      '/osdev/09-bootloader-p4.md',
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
