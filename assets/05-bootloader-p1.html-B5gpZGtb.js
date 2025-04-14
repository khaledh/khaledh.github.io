import{_ as n,c as a,e,o as t}from"./app-0wItSCmZ.js";const i="/assets/uefi-menu-Cn-u_KK6.png",l="/assets/uefi-shell-B0HS_H9R.png",o="/assets/checking-bootloader-wvRJYy-s.png",p={};function c(r,s){return t(),a("div",null,s[0]||(s[0]=[e(`<h1 id="uefi-bootloader-part-1" tabindex="-1"><a class="header-anchor" href="#uefi-bootloader-part-1"><span>UEFI Bootloader (Part 1)</span></a></h1><p>Now that we have a solid base to target UEFI in a freestanding environment, we can start writing our bootloader. Writing a UEFI bootloader is a complex task. In this section, we&#39;ll start by writing a simple UEFI entry point for the bootloader, which we&#39;ll build on later.</p><h2 id="entry-point" tabindex="-1"><a class="header-anchor" href="#entry-point"><span>Entry point</span></a></h2><p>The UEFI spec defines an application&#39;s entry point as:</p><div class="language-c line-numbers-mode" data-highlighter="prismjs" data-ext="c" data-title="c"><pre><code><span class="line"><span class="token comment">// UEFI Specification v2.10, Section 4.11</span></span>
<span class="line"><span class="token comment">// https://uefi.org/specs/UEFI/2.10/04_EFI_System_Table.html?highlight=efi_system_table#efi-image-entry-point</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">typedef</span> <span class="token class-name">uint64_t</span> UINTN<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">typedef</span> UINTN EFI_STATUS<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">typedef</span> <span class="token keyword">void</span> <span class="token operator">*</span>EFI_HANDLE<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">typedef</span> <span class="token keyword">struct</span> <span class="token punctuation">{</span> <span class="token punctuation">.</span><span class="token punctuation">.</span><span class="token punctuation">.</span> <span class="token punctuation">}</span> EFI_SYSTEM_TABLE<span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">typedef</span> <span class="token function">EFI_STATUS</span> <span class="token punctuation">(</span><span class="token operator">*</span>EFI_IMAGE_ENTRY_POINT<span class="token punctuation">)</span><span class="token punctuation">(</span></span>
<span class="line">  IN EFI_HANDLE        ImageHandle<span class="token punctuation">,</span></span>
<span class="line">  IN EFI_SYSTEM_TABLE  <span class="token operator">*</span>SystemTable</span>
<span class="line"><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>where <code>ImageHandle</code> is a handle to the loaded image, and <code>SystemTable</code> is a pointer to the system table. We&#39;ll come back to them later. Based on this definition, we&#39;ll define our entry point in <code>src/bootx64.nim</code>:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/bootx64.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">import</span> libc</span>
<span class="line"></span>
<span class="line"><span class="token keyword">type</span></span>
<span class="line">  EfiStatus <span class="token operator">=</span> uint</span>
<span class="line">  EfiHandle <span class="token operator">=</span> pointer</span>
<span class="line">  EFiSystemTable <span class="token operator">=</span> <span class="token keyword">object</span>  <span class="token comment"># to be defined later</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">const</span></span>
<span class="line">  EfiSuccess <span class="token operator">=</span> <span class="token number">0</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">EfiMain</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">return</span> EfiSuccess</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>I&#39;m also changing the entry point from <code>main</code> to <code>EfiMain</code>, which is a typical convention for UEFI applications. Let&#39;s change the entry point in the linker arguments in <code>nim.cfg</code>:</p><div class="language-properties line-numbers-mode" data-highlighter="prismjs" data-ext="properties" data-title="properties"><pre><code><span class="line"><span class="token comment"># nim.cfg</span></span>
<span class="line">...</span>
<span class="line"><span class="token key attr-name">--passl</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-Wl,-entry:EfiMain&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s compile the code, changing the output executable to <code>bootx64.efi</code>:</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">nim c <span class="token parameter variable">--os:any</span> src/bootx64.nim --out:build/bootx64.efi</span></span></span>
<span class="line"><span class="token output">...</span>
<span class="line"></span>
<span class="line"></span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">file</span> build/bootx64.efi</span></span></span>
<span class="line"><span class="token output">build/bootx64.efi: PE32+ executable (EFI application) x86-64, for MS Windows, 4 sections</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! We have a minimal UEFI bootloader application. Let&#39;s see if we can load it in QEMU. But before we do that, we need to run QEMU with a UEFI firmware image instead of the default legacy BIOS.</p><h2 id="ovmf-uefi-firmware" tabindex="-1"><a class="header-anchor" href="#ovmf-uefi-firmware"><span>OVMF UEFI Firmware</span></a></h2><p>The default BIOS for QEMU is a legacy BIOS. We need to use a UEFI BIOS instead. We can use OVMF (Open Virtual Machine Firmware), which is an open-source UEFI firmware from TianoCore&#39;s EDK II project. There are some prebuilt packages available for Linux and macOS. We can also build it from source, but we&#39;ll leave that for another time if we need to.</p><p>On Arch Linux:</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">sudo</span> pacman <span class="token parameter variable">-S</span> edk2-ovmf</span></span></span>
<span class="line"><span class="token output">...</span>
<span class="line"></span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token comment"># The OVMF image is installed to /usr/share/edk2-ovmf/x64/OVMF_CODE.fd</span></span></span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>For macOS, we can use a Homebrew package (<a href="https://gist.github.com/haharoit/a81fecd847003626ef9ef700e4901d15" target="_blank" rel="noopener noreferrer">not official</a>, but it will do):</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">brew tap uenob/qemu-hvf</span></span></span>
<span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">brew <span class="token function">install</span> ovmf</span></span></span>
<span class="line"><span class="token output">...</span>
<span class="line"></span>
<span class="line"></span><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token comment"># The OVMF image is installed to /opt/homebrew/opt/ovmf/share/OVMF/OvmfX64/OVMF_CODE.fd</span></span></span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>There are two files we&#39;re interested in: <code>OVMF_CODE.fd</code> and <code>OVMF_VARS.fd</code>. The first one is the firmware image, and the second one is the NVRAM image that contains UEFI variables that persist across reboots, and it needs to be writable. Let&#39;s copy them to our project directory, mainly to avoid depending on the system&#39;s OVMF installation and also to be able to write to the NVRAM image:</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">mkdir</span> ovmf</span></span></span>
<span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">cp</span> /usr/share/edk2-ovmf/x64/OVMF_<span class="token punctuation">{</span>CODE,VARS<span class="token punctuation">}</span>.fd ovmf</span></span></span>
<span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">chmod</span> +w ovmf/OVMF_VARS.fd</span></span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="loading-the-bootloader" tabindex="-1"><a class="header-anchor" href="#loading-the-bootloader"><span>Loading the bootloader</span></a></h2><p>The firmware expects to find a bootloader at a specific path in a FAT filesystem: <code>EFI\\BOOT\\BOOTX64.EFI</code>. We can create a disk image with such a filesystem, but QEMU has a nice trick up its sleeve that we can use to speed up our iteration. We can use the <code>-drive</code> flag to mount a directory as a virtual FAT filesystem. Let&#39;s create a directory structure to mount as a virtual disk and copy our bootloader to it:</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">mkdir</span> <span class="token parameter variable">-p</span> diskimg/efi/boot</span></span></span>
<span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">cat</span> diskimg <span class="token operator">&gt;&gt;</span> .gitignore</span></span></span>
<span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">cp</span> build/bootx64.efi diskimg/efi/boot/bootx64.efi</span></span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we ask QEMU to use the <code>diskimg</code> directory as a virtual FAT filesystem. A couple of notes on the QEMU arguments I used:</p><ul><li>I&#39;m setting <code>-machine q35</code> to use the Q35 + ICH9 chipsets (circa 2009) instead of the default i440FX + PIIX chipsets (circa 1996). This gives us a more modern environment with support for PCI Express, AHCI, and better UEFI, ACPI, and USB support.</li><li>I&#39;m setting <code>-nic none</code> to disable the default network card (to prevent the firmware from trying to use PXE network boot).</li></ul><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">qemu-system-x86_64 <span class="token punctuation">\\</span></span>
<span class="line">    <span class="token parameter variable">-drive</span> <span class="token assign-left variable">if</span><span class="token operator">=</span>pflash,format<span class="token operator">=</span>raw,file<span class="token operator">=</span>ovmf/OVMF_CODE.fd,readonly<span class="token operator">=</span>on <span class="token punctuation">\\</span></span>
<span class="line">    <span class="token parameter variable">-drive</span> <span class="token assign-left variable">if</span><span class="token operator">=</span>pflash,format<span class="token operator">=</span>raw,file<span class="token operator">=</span>ovmf/OVMF_VARS.fd <span class="token punctuation">\\</span></span>
<span class="line">    <span class="token parameter variable">-drive</span> <span class="token assign-left variable">format</span><span class="token operator">=</span>raw,file<span class="token operator">=</span>fat:rw:diskimg <span class="token punctuation">\\</span></span>
<span class="line">    <span class="token parameter variable">-machine</span> q35 <span class="token punctuation">\\</span></span>
<span class="line">    <span class="token parameter variable">-net</span> none</span></span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;re greeted with the TianoCore splash screen, and then we are dropped into the UEFI boot menu:</p><p><img src="`+i+`" alt="UEFI Menu"></p><p>The spec says that upon boot, the firmware should try the available boot options (e.g., DVD-ROM, HDD, etc.) stored in <em>Boot####</em> variables, in an order also stored in a variable called <em>BootOrder</em>. In the case of OVMF, the default boot order is DVD-ROM, HDD, and then the UEFI shell. If a boot option returns <code>EFI_SUCCESS</code>, the firmware is expected to present a boot manager menu to the user. This is exactly what we&#39;re seeing here since our bootloader returns <code>EFI_SUCCESS</code> from the entry point.</p><p>On the other hand, if the bootloader returns any other value, the firmware is expected to try the next boot option, which in the case of OVMF is the UEFI shell. Let&#39;s change the return value of our bootloader to <code>EFI_LOAD_ERROR</code> (numeric value <code>1</code>) to see what happens:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/bootx64.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"><span class="token keyword">const</span></span>
<span class="line">  EfiSuccess <span class="token operator">=</span> <span class="token number">0</span></span>
<span class="line highlighted">  EfiLoadError <span class="token operator">=</span> <span class="token number">1</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">EfiMain</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line highlighted">  <span class="token keyword">return</span> EfiLoadError</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we compile and run the bootloader again, we&#39;re greeted with the UEFI shell, as expected (since it&#39;s the next boot option):</p><p><img src="`+l+'" alt="UEFI Shell"></p><p>Let&#39;s use the UEFI shell to run our bootloader manually and check its exit code using the <code>set lasterror</code> command to make sure that it&#39;s working as expected. The UEFI shell has a <code>map</code> command that lists the available filesystems. By default, the shell already runs this command on startup, so we can see that the virtual FAT filesystem is mounted as <code>fs0</code>. We can use the <code>fs0:</code> prefix to run our bootloader:</p><p><img src="'+o+`" alt="Checking bootloader"></p><p>As expected, the bootloader returns <code>1</code> as its exit code. Great! Now we have a working bootloader (if you can call it that). In the next section, we&#39;ll implement text output using the UEFI console so that we can print messages to the screen. But before we do that, let&#39;s add a build tool to our project so that we don&#39;t have to repeat the same commands over and over again.</p><h2 id="build-tool" tabindex="-1"><a class="header-anchor" href="#build-tool"><span>Build tool</span></a></h2><p>Typically, we&#39;d use <code>make</code> to build our project, but I&#39;m not a big fan of <code>make</code>. I recently started using the <a href="https://github.com/casey/just" target="_blank" rel="noopener noreferrer"><code>Just</code></a> build tool, which is a simple command runner that uses a <code>justfile</code> to define commands. Assuming it&#39;s already installed, let&#39;s create a <code>justfile</code> in the project root directory:</p><div class="language-justfile line-numbers-mode" data-highlighter="prismjs" data-ext="justfile" data-title="justfile"><pre><code><span class="line"># justfile</span>
<span class="line"></span>
<span class="line">nimflags := &quot;--os:any&quot;</span>
<span class="line"></span>
<span class="line">bootloader:</span>
<span class="line">  nim c {{nimflags}} src/bootx64.nim --out:build/bootx64.efi</span>
<span class="line"></span>
<span class="line">run: bootloader</span>
<span class="line">  mkdir -p diskimg/efi/boot</span>
<span class="line">  cp build/bootx64.efi diskimg/efi/boot/bootx64.efi</span>
<span class="line">  qemu-system-x86_64 \\</span>
<span class="line">    -drive if=pflash,format=raw,file=ovmf/OVMF_CODE.fd,readonly=on \\</span>
<span class="line">    -drive if=pflash,format=raw,file=ovmf/OVMF_VARS.fd \\</span>
<span class="line">    -drive format=raw,file=fat:rw:diskimg \\</span>
<span class="line">    -machine q35 \\</span>
<span class="line">    -net none</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we can build and run our bootloader using <code>just</code>:</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">just run</span></span></span>
<span class="line"><span class="token output">nim ...</span>
<span class="line">mkdir ...</span>
<span class="line">cp ...</span>
<span class="line">qemu-system-x86_64 ...</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Much better!</p>`,42)]))}const u=n(p,[["render",c],["__file","05-bootloader-p1.html.vue"]]),m=JSON.parse(`{"path":"/osdev/05-bootloader-p1.html","title":"UEFI Bootloader (Part 1)","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Entry point","slug":"entry-point","link":"#entry-point","children":[]},{"level":2,"title":"OVMF UEFI Firmware","slug":"ovmf-uefi-firmware","link":"#ovmf-uefi-firmware","children":[]},{"level":2,"title":"Loading the bootloader","slug":"loading-the-bootloader","link":"#loading-the-bootloader","children":[]},{"level":2,"title":"Build tool","slug":"build-tool","link":"#build-tool","children":[]}],"git":{"updatedTime":1744638230000},"filePathRelative":"osdev/05-bootloader-p1.md","excerpt":"\\n<p>Now that we have a solid base to target UEFI in a freestanding environment, we can start\\nwriting our bootloader. Writing a UEFI bootloader is a complex task. In this section,\\nwe'll start by writing a simple UEFI entry point for the bootloader, which we'll build on\\nlater.</p>\\n<h2>Entry point</h2>"}`);export{u as comp,m as data};
