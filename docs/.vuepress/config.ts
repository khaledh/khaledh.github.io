import { defineUserConfig } from 'vuepress'
import { defaultTheme } from 'vuepress'

export default defineUserConfig({
  lang: 'en-US',
  title: '0xc0ffee',
  description: 'Khaled Hammouda\'s blog',
  theme: defaultTheme({
    sidebar: [
      '/',
      '/osdev/',
      '/osdev/writing-an-os-in-nim.md',
    ]
  }),
})
