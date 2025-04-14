import{_ as n,c as a,e,o as l}from"./app-0wItSCmZ.js";const i={};function p(t,s){return l(),a("div",null,s[0]||(s[0]=[e(`<h1 id="user-mode" tabindex="-1"><a class="header-anchor" href="#user-mode"><span>User Mode</span></a></h1><p>Running programs in user mode is one of the most important features of an operating system. It provides a controlled environment for programs to run in, and prevents them from interfering with each other or the kernel. This is done by restricting the instructions that can be executed, and the memory that can be accessed. Once in user mode, a program can only return to kernel mode by executing a system call or through an interrupt (e.g. a timer interrupt). Even exiting the program requires a system call. We won&#39;t be implementing system calls in this section. We&#39;ll just focus on switching from kernel mode to user mode. The user program won&#39;t be able to do anything useful for now, but we should have a minimal user mode environment to build on later.</p><p>The main way to switch to user mode is to manually create an interrupt stack frame, as if the user program had just been interrupted by an interrupt. It should look like this:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">            Stack</span>
<span class="line">                     ┌──── stack bottom</span>
<span class="line">    ┌────────────────▼─┐</span>
<span class="line">    │        SS        │ +32  ◄── Data segment selector</span>
<span class="line">    ├──────────────────┤</span>
<span class="line">    │        RSP       │ +24  ◄── User stack pointer</span>
<span class="line">    ├──────────────────┤</span>
<span class="line">    │       RFLAGS     │ +16  ◄── CPU flags with IF=1</span>
<span class="line">    ├──────────────────┤</span>
<span class="line">    │        CS        │ +8   ◄── User code segment selector</span>
<span class="line">    ├──────────────────┤</span>
<span class="line">    │        RIP       │ 0    ◄── User code entry point</span>
<span class="line">    ├────────────────▲─┤</span>
<span class="line">    │                └──── stack top</span>
<span class="line">    ├──────────────────┤</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Then we can use the <code>iretq</code> instruction to switch to user mode. The <code>iretq</code> instruction pops the stack frame, loads the <code>SS</code> and <code>RSP</code> registers to switch to the user stack, loads the <code>RFLAGS</code> register, and loads the <code>CS</code> and <code>RIP</code> registers to switch to the user code entry point. The <code>RFLAGS</code> value should have the IF flag set to 1, which enables interrupts. This is important, because it allows the kernel to take control back from the user program when an interrupt occurs.</p><p>An important thing to note is that, since this stack frame is at the bottom of the stack ( i.e. highest address in the page where the stack is mapped), if the user program returns from the entry point, a page fault will occur, since the area above the stack is unmapped. As mentioned earlier, the only way to return to kernel mode is through a system call or an interrupt. So, for the purpose of this section, we&#39;ll just create a user program that never returns (until we implement system calls).</p><h2 id="preparing-for-user-mode" tabindex="-1"><a class="header-anchor" href="#preparing-for-user-mode"><span>Preparing for User Mode</span></a></h2><p>So far, the virtual memory mapping we have is for kernel space only. We need to create a different mapping for user space so that the user program can access it. This includes mapping of the user code, data, and stack regions, as well as the kernel space (which is protected since it&#39;s marked as supervisor only). Mapping the kernel space in the user page table is necessary, since interrupts and system calls cause the CPU to jump to kernel code without switching page tables. Also, many system calls will need access to data in user space.</p><p>Since we don&#39;t have the ability in the kernel to access disks and filesystems yet, we won&#39;t load the user program from disk. What we can do is build the user program separately, and copy it alongside the kernel image, and let the bootloader load it for us. So here&#39;s the plan to get user mode working:</p><ol><li>Create a program that we want to run in user mode.</li><li>Build the program and copy it to the <code>efi\\fusion</code> directory (next to the kernel image).</li><li>In the bootloader, load the user program into memory, and pass its physical address and size to the kernel.</li><li>Allocate memory for the user stack.</li><li>Create a new page table for user space.</li><li>Map the user code and stack regions to user space.</li><li>Copy the kernel space page table entries to the user page table.</li><li>Craft an interrupt stack frame that will switch to user mode. Place it at the bottom of the user stack (i.e. the top of the mapped stack region).</li><li>Change the <code>rsp</code> register to point to the top of the interrupt stack frame (i.e. the last pushed value).</li><li>Load the user page table physical address into the <code>cr3</code> register.</li><li>Use the <code>iretq</code> instruction to pop the interrupt stack frame and switch to user mode.</li></ol><h2 id="user-program" tabindex="-1"><a class="header-anchor" href="#user-program"><span>User Program</span></a></h2><p>Let&#39;s start by creating a new module in <code>src/user/utask.nim</code> for the user code, and defining a function that we want to run in user mode. We&#39;ll call it <code>UserMain</code>.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/user/utask.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token punctuation">{.</span>used<span class="token punctuation">.}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">UserMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">  .loop:</span>
<span class="line">    pause</span>
<span class="line">    jmp .loop</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The function will just execute the <code>pause</code> instruction in a loop. The <code>pause</code> instruction is a hint to the CPU that the code is in a spin loop, allowing it to greatly reduce the processor&#39;s power consumption.</p><p>Let&#39;s create a linker script to define the layout of the user code and data sections. It&#39;s very similar to the kernel linker script, except we link the user program at a virtual address in user space, instead of kernel space (it doesn&#39;t matter where in user space, as long as it&#39;s mapped).</p><div class="language-ld line-numbers-mode" data-highlighter="prismjs" data-ext="ld" data-title="ld"><pre><code><span class="line"><span class="token comment">/* src/user/utask.ld */</span></span>
<span class="line"></span>
<span class="line">SECTIONS</span>
<span class="line"><span class="token punctuation">{</span></span>
<span class="line">  <span class="token location-counter important">.</span> <span class="token operator">=</span> <span class="token number">0x00000000040000000</span><span class="token punctuation">;</span> <span class="token comment">/* 1 GiB */</span></span>
<span class="line">  <span class="token section keyword">.text</span>   <span class="token operator">:</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token operator">*</span>utask<span class="token operator">*</span>.o<span class="token punctuation">(</span><span class="token location-counter important">.</span><span class="token operator">*</span>text.UserMain<span class="token punctuation">)</span></span>
<span class="line">    <span class="token operator">*</span>utask<span class="token operator">*</span>.o<span class="token punctuation">(</span><span class="token location-counter important">.</span><span class="token operator">*</span>text.<span class="token operator">*</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token operator">*</span><span class="token punctuation">(</span><span class="token location-counter important">.</span><span class="token operator">*</span>text<span class="token operator">*</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token punctuation">}</span></span>
<span class="line">  <span class="token section keyword">.rodata</span> <span class="token operator">:</span> <span class="token punctuation">{</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token location-counter important">.</span><span class="token operator">*</span>rodata<span class="token operator">*</span><span class="token punctuation">)</span> <span class="token punctuation">}</span></span>
<span class="line">  <span class="token section keyword">.data</span>   <span class="token operator">:</span> <span class="token punctuation">{</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token location-counter important">.</span><span class="token operator">*</span>data<span class="token punctuation">)</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token location-counter important">.</span><span class="token operator">*</span>bss<span class="token punctuation">)</span> <span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line">  <span class="token section keyword">.shstrtab</span> <span class="token operator">:</span> <span class="token punctuation">{</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token section keyword">.shstrtab</span><span class="token punctuation">)</span> <span class="token punctuation">}</span> <span class="token comment">/* cannot be discarded */</span></span>
<span class="line">  <span class="token operator">/</span>DISCARD<span class="token operator">/</span> <span class="token operator">:</span> <span class="token punctuation">{</span> <span class="token operator">*</span><span class="token punctuation">(</span><span class="token operator">*</span><span class="token punctuation">)</span> <span class="token punctuation">}</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s add a <code>nim.cfg</code> file to the <code>src/user</code> directory to configure the Nim compiler for the user program. It should be very similar to the kernel <code>nim.cfg</code> file.</p><div class="language-properties line-numbers-mode" data-highlighter="prismjs" data-ext="properties" data-title="properties"><pre><code><span class="line"><span class="token comment"># src/user/nim.cfg</span></span>
<span class="line"><span class="token key attr-name">amd64.any.clang.linkerexe</span><span class="token punctuation">=</span><span class="token value attr-value">&quot;ld.lld&quot;</span></span>
<span class="line"><span class="token key attr-name">--passc</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-target x86_64-unknown-none&quot;</span></span>
<span class="line"><span class="token key attr-name">--passc</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-ffreestanding&quot;</span></span>
<span class="line"><span class="token key attr-name">--passc</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-ffunction-sections&quot;</span></span>
<span class="line"><span class="token key attr-name">--passc</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-mcmodel=large&quot;</span></span>
<span class="line"><span class="token key attr-name">--passl</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-nostdlib&quot;</span></span>
<span class="line"><span class="token key attr-name">--passl</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-T src/user/utask.ld&quot;</span></span>
<span class="line"><span class="token key attr-name">--passl</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-entry=UserMain&quot;</span></span>
<span class="line"><span class="token key attr-name">--passl</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;-Map=build/utask.map&quot;</span></span>
<span class="line"><span class="token key attr-name">--passl</span><span class="token punctuation">:</span><span class="token value attr-value">&quot;--oformat=binary&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s update our <code>justfile</code> to build the user program and copy it in place.</p><div class="language-justfile line-numbers-mode" data-highlighter="prismjs" data-ext="justfile" data-title="justfile"><pre><code><span class="line">...</span>
<span class="line"></span>
<span class="line highlighted">user_nim := &quot;src/user/utask.nim&quot;</span>
<span class="line highlighted">user_out := &quot;utask.bin&quot;</span>
<span class="line"></span>
<span class="line">...</span>
<span class="line"></span>
<span class="line highlighted">user:</span>
<span class="line highlighted">  nim c {{nimflags}} --out:build/{{user_out}} {{user_nim}}</span>
<span class="line"></span>
<span class="line highlighted">run *QEMU_ARGS: bootloader kernel user</span>
<span class="line">  mkdir -p {{disk_image_dir}}/efi/boot</span>
<span class="line">  mkdir -p {{disk_image_dir}}/efi/fusion</span>
<span class="line">  cp build/{{boot_out}} {{disk_image_dir}}/efi/boot/{{boot_out}}</span>
<span class="line">  cp build/{{kernel_out}} {{disk_image_dir}}/efi/fusion/{{kernel_out}}</span>
<span class="line highlighted">  cp build/{{user_out}} {{disk_image_dir}}/efi/fusion/{{user_out}}</span>
<span class="line"></span>
<span class="line">  @echo &quot;&quot;</span>
<span class="line">  qemu-system-x86_64 \\</span>
<span class="line">    -drive if=pflash,format=raw,file={{ovmf_code}},readonly=on \\</span>
<span class="line">    -drive if=pflash,format=raw,file={{ovmf_vars}} \\</span>
<span class="line">    -drive format=raw,file=fat:rw:{{disk_image_dir}} \\</span>
<span class="line">    -machine q35 \\</span>
<span class="line">    -net none \\</span>
<span class="line">    -debugcon stdio {{QEMU_ARGS}}</span>
<span class="line"></span>
<span class="line">clean:</span>
<span class="line">  rm -rf build</span>
<span class="line">  rm -rf {{disk_image_dir}}/efi/boot/{{boot_out}}</span>
<span class="line">  rm -rf {{disk_image_dir}}/efi/fusion/{{kernel_out}}</span>
<span class="line highlighted">  rm -rf {{disk_image_dir}}/efi/fusion/{{user_out}}</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Finally, let&#39;s build the user program and check the linker map.</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash">just user</span></span></span>
<span class="line"></span>
<span class="line"><span class="token command"><span class="token shell-symbol important">$</span> <span class="token bash language-bash"><span class="token function">head</span> <span class="token parameter variable">-n</span> <span class="token number">20</span> build/utask.map</span></span></span>
<span class="line"><span class="token output">        VMA              LMA     Size Align Out     In      Symbol</span>
<span class="line">          0                0 40000000     1 . = 0x00000000040000000</span>
<span class="line">   40000000         40000000     9fec    16 .text</span>
<span class="line">   40000000         40000000       59    16         .../fusion/build/@mutask.nim.c.o:(.ltext.UserMain)</span>
<span class="line">   40000000         40000000       59     1                 UserMain</span>
<span class="line">   40000060         40000060       9b    16         .../fusion/build/@mutask.nim.c.o:(.ltext.nimFrame)</span>
<span class="line">   40000060         40000060       9b     1                 nimFrame</span>
<span class="line">   40000100         40000100       12    16         .../fusion/build/@mutask.nim.c.o:(.ltext.PreMainInner)</span>
<span class="line">   40000100         40000100       12     1                 PreMainInner</span>
<span class="line">   40000120         40000120       1e    16         .../fusion/build/@mutask.nim.c.o:(.ltext.PreMain)</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This looks good. The <code>UserMain</code> function linked first and starts at <code>0x40000000</code>, which is what we asked for.</p><h2 id="loading-the-user-program" tabindex="-1"><a class="header-anchor" href="#loading-the-user-program"><span>Loading the User Program</span></a></h2><p>Now, let&#39;s try to load the user program in the bootloader. We&#39;ll do the same thing we did for the kernel, except we&#39;ll load the user program to an arbitrary physical address, instead of a specific address. We&#39;ll mark this region of memory as <code>UserCode</code> so that it&#39;s not considered free.</p><p>In the bootloader, we already have code that loads the kernel image. Let&#39;s reuse this code to load the user program. Let&#39;s refactor this code into a <code>loadImage</code> proc, and use it for both the kernel and the user task.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/boot/bootx64.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">loadImage</span><span class="token punctuation">(</span></span>
<span class="line">  imagePath<span class="token operator">:</span> WideCString<span class="token punctuation">,</span></span>
<span class="line">  rootDir<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol<span class="token punctuation">,</span></span>
<span class="line">  memoryType<span class="token operator">:</span> EfiMemoryType<span class="token punctuation">,</span></span>
<span class="line">  loadAddress<span class="token operator">:</span> Option<span class="token punctuation">[</span>EfiPhysicalAddress<span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">none</span><span class="token punctuation">(</span>EfiPhysicalAddress<span class="token punctuation">)</span><span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">)</span><span class="token operator">:</span> <span class="token keyword">tuple</span><span class="token punctuation">[</span>base<span class="token operator">:</span> EfiPhysicalAddress<span class="token punctuation">,</span> pages<span class="token operator">:</span> uint64<span class="token punctuation">]</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token comment"># open the image file</span></span>
<span class="line">  <span class="token keyword">var</span> file<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol</span>
<span class="line"></span>
<span class="line">  consoleOut <span class="token string">&quot;boot: Opening image: &quot;</span></span>
<span class="line">  consoleOut imagePath</span>
<span class="line">  checkStatus rootDir<span class="token operator">.</span><span class="token function">open</span><span class="token punctuation">(</span>rootDir<span class="token punctuation">,</span> <span class="token keyword">addr</span> file<span class="token punctuation">,</span> imagePath<span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># get file size</span></span>
<span class="line">  <span class="token keyword">var</span> fileInfo<span class="token operator">:</span> EfiFileInfo</span>
<span class="line">  <span class="token keyword">var</span> fileInfoSize <span class="token operator">=</span> <span class="token function">sizeof</span><span class="token punctuation">(</span>EfiFileInfo<span class="token punctuation">)</span><span class="token operator">.</span>uint</span>
<span class="line"></span>
<span class="line">  consoleOut <span class="token string">&quot;boot: Getting file info&quot;</span></span>
<span class="line">  checkStatus file<span class="token operator">.</span><span class="token function">getInfo</span><span class="token punctuation">(</span></span>
<span class="line">    file<span class="token punctuation">,</span> <span class="token keyword">addr</span> EfiFileInfoGuid<span class="token punctuation">,</span> <span class="token keyword">addr</span> fileInfoSize<span class="token punctuation">,</span> <span class="token keyword">addr</span> fileInfo</span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line">  echo <span class="token operator">&amp;</span><span class="token string">&quot;boot: Image file size: {fileInfo.fileSize} bytes&quot;</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">var</span> imageBase<span class="token operator">:</span> EfiPhysicalAddress</span>
<span class="line">  <span class="token keyword">let</span> imagePages <span class="token operator">=</span> <span class="token punctuation">(</span>fileInfo<span class="token operator">.</span>fileSize <span class="token operator">+</span> <span class="token number">0xFFF</span><span class="token punctuation">)</span><span class="token operator">.</span>uint <span class="token operator">div</span> PageSize<span class="token operator">.</span>uint <span class="token comment"># round up to nearest page</span></span>
<span class="line"></span>
<span class="line">  consoleOut <span class="token operator">&amp;</span><span class="token string">&quot;boot: Allocating memory for image&quot;</span></span>
<span class="line">  <span class="token keyword">if</span> loadAddress<span class="token operator">.</span>isSome<span class="token operator">:</span></span>
<span class="line">    imageBase <span class="token operator">=</span> <span class="token function">cast[EfiPhysicalAddress]</span><span class="token punctuation">(</span>loadAddress<span class="token operator">.</span>get<span class="token punctuation">)</span></span>
<span class="line">    checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">allocatePages</span><span class="token punctuation">(</span></span>
<span class="line">      AllocateAddress<span class="token punctuation">,</span></span>
<span class="line">      memoryType<span class="token punctuation">,</span></span>
<span class="line">      imagePages<span class="token punctuation">,</span></span>
<span class="line">      <span class="token function">cast[ptr EfiPhysicalAddress]</span><span class="token punctuation">(</span>imageBase<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">    checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">allocatePages</span><span class="token punctuation">(</span></span>
<span class="line">      AllocateAnyPages<span class="token punctuation">,</span></span>
<span class="line">      memoryType<span class="token punctuation">,</span></span>
<span class="line">      imagePages<span class="token punctuation">,</span></span>
<span class="line">      <span class="token function">cast[ptr EfiPhysicalAddress]</span><span class="token punctuation">(</span>imageBase<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># read the image into memory</span></span>
<span class="line">  consoleOut <span class="token string">&quot;boot: Reading image into memory&quot;</span></span>
<span class="line">  checkStatus file<span class="token operator">.</span><span class="token function">read</span><span class="token punctuation">(</span>file<span class="token punctuation">,</span> <span class="token function">cast[ptr uint]</span><span class="token punctuation">(</span><span class="token keyword">addr</span> fileInfo<span class="token operator">.</span>fileSize<span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token function">cast[pointer]</span><span class="token punctuation">(</span>imageBase<span class="token punctuation">)</span><span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># close the image file</span></span>
<span class="line">  consoleOut <span class="token string">&quot;boot: Closing image file&quot;</span></span>
<span class="line">  checkStatus file<span class="token operator">.</span><span class="token function">close</span><span class="token punctuation">(</span>file<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  result <span class="token operator">=</span> <span class="token punctuation">(</span>imageBase<span class="token punctuation">,</span> imagePages<span class="token operator">.</span>uint64<span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The proc allows loading an image at a specific address (if <code>loadAddress</code> is provided), or at any address (if <code>loadAddress</code> is <code>none</code>). The former is useful for loading the kernel image at a specific address. The latter is useful for loading the user program at any address.</p><p>Let&#39;s now update the <code>EfiMainInner</code> by replacing that section of the code with two calls to <code>loadImage</code>.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/boot/bootx64.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># open the root directory</span></span>
<span class="line">  <span class="token keyword">var</span> rootDir<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol</span>
<span class="line"></span>
<span class="line">  consoleOut <span class="token string">&quot;boot: Opening root directory&quot;</span></span>
<span class="line">  checkStatus fileSystem<span class="token operator">.</span><span class="token function">openVolume</span><span class="token punctuation">(</span>fileSystem<span class="token punctuation">,</span> <span class="token keyword">addr</span> rootDir<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line highlighted">  <span class="token comment"># load kernel image</span></span>
<span class="line highlighted">  <span class="token function">let</span> <span class="token punctuation">(</span>kernelImageBase<span class="token punctuation">,</span> kernelImagePages<span class="token punctuation">)</span> <span class="token operator">=</span> <span class="token function">loadImage</span><span class="token punctuation">(</span></span>
<span class="line highlighted">    imagePath <span class="token operator">=</span> <span class="token string">W&quot;efi\\fusion\\kernel.bin&quot;</span><span class="token punctuation">,</span></span>
<span class="line highlighted">    rootDir <span class="token operator">=</span> rootDir<span class="token punctuation">,</span></span>
<span class="line highlighted">    memoryType <span class="token operator">=</span> OsvKernelCode<span class="token punctuation">,</span></span>
<span class="line highlighted">    loadAddress <span class="token operator">=</span> KernelPhysicalBase<span class="token operator">.</span>EfiPhysicalAddress<span class="token operator">.</span>some</span>
<span class="line highlighted">  <span class="token punctuation">)</span></span>
<span class="line highlighted"></span>
<span class="line highlighted">  <span class="token comment"># load user task image</span></span>
<span class="line highlighted">  <span class="token function">let</span> <span class="token punctuation">(</span>userImageBase<span class="token punctuation">,</span> userImagePages<span class="token punctuation">)</span> <span class="token operator">=</span> <span class="token function">loadImage</span><span class="token punctuation">(</span></span>
<span class="line highlighted">    imagePath <span class="token operator">=</span> <span class="token string">W&quot;efi\\fusion\\utask.bin&quot;</span><span class="token punctuation">,</span></span>
<span class="line highlighted">    rootDir <span class="token operator">=</span> rootDir<span class="token punctuation">,</span></span>
<span class="line highlighted">    memoryType <span class="token operator">=</span> OsvUserCode<span class="token punctuation">,</span></span>
<span class="line highlighted">  <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># close the root directory</span></span>
<span class="line">  consoleOut <span class="token string">&quot;boot: Closing root directory&quot;</span></span>
<span class="line">  checkStatus rootDir<span class="token operator">.</span><span class="token function">close</span><span class="token punctuation">(</span>rootDir<span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that I added a new value to the <code>EfiMemoryType</code> enum called <code>OsvUserCode</code>. This is just a value that we&#39;ll use to mark the user code region as used. Here&#39;s the updated enum:</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/common/uefi.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  EfiMemoryType<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">enum</span></span>
<span class="line">    <span class="token operator">...</span></span>
<span class="line">    OsvKernelCode <span class="token operator">=</span> <span class="token number">0x80000000</span></span>
<span class="line">    OsvKernelData <span class="token operator">=</span> <span class="token number">0x80000001</span></span>
<span class="line">    OsvKernelStack <span class="token operator">=</span> <span class="token number">0x80000002</span></span>
<span class="line highlighted">    OsvUserCode <span class="token operator">=</span> <span class="token number">0x80000003</span></span>
<span class="line">    EfiMaxMemoryType</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s map this value to a new <code>UserCode</code> value in our <code>MemoryType</code> enum (which is what we pass to the kernel as part of the memory map). While we&#39;re here, I&#39;m going to also add values for <code>UserData</code> and <code>UserStack</code> (which we&#39;ll use later).</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/common/bootinfo.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">type</span></span>
<span class="line">  MemoryType<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">enum</span></span>
<span class="line">    Free</span>
<span class="line">    KernelCode</span>
<span class="line">    KernelData</span>
<span class="line">    KernelStack</span>
<span class="line highlighted">    UserCode</span>
<span class="line highlighted">    UserData</span>
<span class="line highlighted">    UserStack</span>
<span class="line">    Reserved</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s also update <code>convertUefiMemoryMap</code> to account for the new memory type.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/boot/bootx64.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">convertUefiMemoryMap</span><span class="token punctuation">(</span><span class="token operator">..</span><span class="token punctuation">.)</span><span class="token operator">:</span> seq<span class="token punctuation">[</span>MemoryMapEntry<span class="token punctuation">]</span> <span class="token operator">=</span></span>
<span class="line">   <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">for</span> i <span class="token operator">in</span> <span class="token number">0</span> <span class="token operator">..&lt;</span> uefiNumMemoryMapEntries<span class="token operator">:</span></span>
<span class="line">    <span class="token operator">...</span></span>
<span class="line">    <span class="token keyword">let</span> memoryType <span class="token operator">=</span></span>
<span class="line">      <span class="token keyword">if</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">in</span> FreeMemoryTypes<span class="token operator">:</span></span>
<span class="line">        Free</span>
<span class="line">      <span class="token keyword">elif</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> OsvKernelCode<span class="token operator">:</span></span>
<span class="line">        KernelCode</span>
<span class="line">      <span class="token keyword">elif</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> OsvKernelData<span class="token operator">:</span></span>
<span class="line">        KernelData</span>
<span class="line">      <span class="token keyword">elif</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> OsvKernelStack<span class="token operator">:</span></span>
<span class="line">        KernelStack</span>
<span class="line highlighted">      <span class="token keyword">elif</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> OsvUserCode<span class="token operator">:</span></span>
<span class="line highlighted">        UserCode</span>
<span class="line">      <span class="token keyword">else</span><span class="token operator">:</span></span>
<span class="line">        Reserved</span>
<span class="line">    <span class="token operator">...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>And finally, we need to tell the kernel where to find the user task image in memory. Let&#39;s add a couple of fields to <code>BootInfo</code> to store the user image physical address and number of pages.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/common/bootinfo.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  BootInfo<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span></span>
<span class="line">    physicalMemoryMap<span class="token operator">*:</span> MemoryMap</span>
<span class="line">    virtualMemoryMap<span class="token operator">*:</span> MemoryMap</span>
<span class="line">    physicalMemoryVirtualBase<span class="token operator">*:</span> uint64</span>
<span class="line highlighted">    userImagePhysicalBase<span class="token operator">*:</span> uint64</span>
<span class="line highlighted">    userImagePages<span class="token operator">*:</span> uint64</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>And to populate the fields, we&#39;ll update <code>createBootInfo</code> to take the values returned by <code>loadImage</code> as parameters.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/boot/bootx64.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">createBootInfo</span><span class="token punctuation">(</span></span>
<span class="line">  bootInfoBase<span class="token operator">:</span> uint64<span class="token punctuation">,</span></span>
<span class="line">  kernelImagePages<span class="token operator">:</span> uint64<span class="token punctuation">,</span></span>
<span class="line">  physMemoryPages<span class="token operator">:</span> uint64<span class="token punctuation">,</span></span>
<span class="line">  physMemoryMap<span class="token operator">:</span> seq<span class="token punctuation">[</span>MemoryMapEntry<span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line">  virtMemoryMap<span class="token operator">:</span> seq<span class="token punctuation">[</span>MemoryMapEntry<span class="token punctuation">]</span><span class="token punctuation">,</span></span>
<span class="line highlighted">  userImageBase<span class="token operator">:</span> uint64<span class="token punctuation">,</span></span>
<span class="line highlighted">  userImagePages<span class="token operator">:</span> uint64<span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">)</span><span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line highlighted">  bootInfo<span class="token operator">.</span>userImagePhysicalBase <span class="token operator">=</span> userImageBase</span>
<span class="line highlighted">  bootInfo<span class="token operator">.</span>userImagePages <span class="token operator">=</span> userImagePages</span>
<span class="line"></span>
<span class="line">  result <span class="token operator">=</span> bootInfo</span>
<span class="line"></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">EfiMain</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">let</span> bootInfo <span class="token operator">=</span> <span class="token function">createBootInfo</span><span class="token punctuation">(</span></span>
<span class="line">    bootInfoBase<span class="token punctuation">,</span></span>
<span class="line">    kernelImagePages<span class="token punctuation">,</span></span>
<span class="line">    physMemoryPages<span class="token punctuation">,</span></span>
<span class="line">    physMemoryMap<span class="token punctuation">,</span></span>
<span class="line">    virtMemoryMap<span class="token punctuation">,</span></span>
<span class="line highlighted">    userImageBase<span class="token punctuation">,</span></span>
<span class="line highlighted">    userImagePages<span class="token punctuation">,</span></span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s test it out by printing the user image physical address and number of pages in the kernel.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: User image physical address: {bootInfo.userImagePhysicalBase:#010x}&quot;</span></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: User image pages: {bootInfo.userImagePages}&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we build and run the kernel, we should see the following output:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Fusion Kernel</span>
<span class="line">...</span>
<span class="line">kernel: Initializing GDT [success]</span>
<span class="line">kernel: Initializing IDT [success]</span>
<span class="line">kernel: User image physical address: 0x06129000</span>
<span class="line">kernel: User image pages: 268</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>It seems like it&#39;s working. The user image is loaded at some address allocated by the bootloader. The kernel now knows where to find the user image, and should be able to map it to user space.</p><h2 id="user-page-table" tabindex="-1"><a class="header-anchor" href="#user-page-table"><span>User Page Table</span></a></h2><p>Now, let&#39;s create a new <code>PML4Table</code> for the user page table. We&#39;ll copy the kernel page table entries to the user page table, and map the user code and stack regions to user space.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">const</span></span>
<span class="line">  UserImageVirtualBase <span class="token operator">=</span> <span class="token number">0x0000000040000000</span></span>
<span class="line">  UserStackVirtualBase <span class="token operator">=</span> <span class="token number">0x0000000050000000</span></span>
<span class="line"></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  debugln <span class="token string">&quot;&quot;</span></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span></span>
<span class="line"></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Initializing user page table&quot;</span></span>
<span class="line">  <span class="token keyword">var</span> upml4 <span class="token operator">=</span> <span class="token function">cast[ptr PML4Table]</span><span class="token punctuation">(</span>new PML4Table<span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel:   Copying kernel space user page table&quot;</span></span>
<span class="line">  <span class="token keyword">var</span> kpml4 <span class="token operator">=</span> <span class="token function">getActivePML4</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">for</span> i <span class="token operator">in</span> <span class="token number">256</span> <span class="token operator">..&lt;</span> <span class="token number">512</span><span class="token operator">:</span></span>
<span class="line">    upml4<span class="token operator">.</span>entries<span class="token punctuation">[</span>i<span class="token punctuation">]</span> <span class="token operator">=</span> kpml4<span class="token operator">.</span>entries<span class="token punctuation">[</span>i<span class="token punctuation">]</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel:   Mapping user image ({UserImageVirtualBase:#x} -&gt; {bootInfo.userImagePhysicalBase:#x})&quot;</span></span>
<span class="line">  <span class="token function">mapRegion</span><span class="token punctuation">(</span></span>
<span class="line">    pml4 <span class="token operator">=</span> upml4<span class="token punctuation">,</span></span>
<span class="line">    virtAddr <span class="token operator">=</span> UserImageVirtualBase<span class="token operator">.</span>VirtAddr<span class="token punctuation">,</span></span>
<span class="line">    physAddr <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePhysicalBase<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span></span>
<span class="line">    pageCount <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePages<span class="token punctuation">,</span></span>
<span class="line">    pageAccess <span class="token operator">=</span> paReadWrite<span class="token punctuation">,</span></span>
<span class="line">    pageMode <span class="token operator">=</span> pmUser<span class="token punctuation">,</span></span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line"></span>
<span class="line">  <span class="token comment"># allocate and map user stack</span></span>
<span class="line">  <span class="token keyword">let</span> userStackPhysAddr <span class="token operator">=</span> <span class="token function">pmAlloc</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token operator">.</span>get</span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel:   Mapping user stack ({UserStackVirtualBase:#x} -&gt; {userStackPhysAddr.uint64:#x})&quot;</span></span>
<span class="line">  <span class="token function">mapRegion</span><span class="token punctuation">(</span></span>
<span class="line">    pml4 <span class="token operator">=</span> upml4<span class="token punctuation">,</span></span>
<span class="line">    virtAddr <span class="token operator">=</span> UserStackVirtualBase<span class="token operator">.</span>VirtAddr<span class="token punctuation">,</span></span>
<span class="line">    physAddr <span class="token operator">=</span> userStackPhysAddr<span class="token punctuation">,</span></span>
<span class="line">    pageCount <span class="token operator">=</span> <span class="token number">1</span><span class="token punctuation">,</span></span>
<span class="line">    pageAccess <span class="token operator">=</span> paReadWrite<span class="token punctuation">,</span></span>
<span class="line">    pageMode <span class="token operator">=</span> pmUser<span class="token punctuation">,</span></span>
<span class="line">  <span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This should be straightforward. A few things to note:</p><ul><li>We don&#39;t physically copy the kernel page table structures to the user page table. We just set the PML4 entries to point to the same page table structures as the kernel page table. This makes the kernel space portion of the user page table dynamic, so that if we change the kernel page table, the user page table will automatically reflect the changes (unless we map new PML4 entries in the kernel page table, which we won&#39;t do for now).</li><li>We&#39;re setting the <code>pageMode</code> to <code>pmUser</code> for the user code and stack regions.</li><li>We allocate one page for the user stack, and map it to the virtual address <code>0x50000000</code>, so the stack region will be <code>0x50000000</code> to <code>0x50001000</code> (end address is exclusive).</li></ul><h2 id="interrupt-stack-frame" tabindex="-1"><a class="header-anchor" href="#interrupt-stack-frame"><span>Interrupt Stack Frame</span></a></h2><p>Now, in order to switch to user mode, we&#39;ll create an interrupt stack frame, as if the user program had just been interrupted. We&#39;ll populate five entries at the bottom of the stack: <code>RIP</code>, <code>CS</code>, <code>RFLAGS</code>, <code>RSP</code>, and <code>SS</code>.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"><span class="token operator">...</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Creating interrupt stack frame&quot;</span></span>
<span class="line">  <span class="token keyword">let</span> userStackBottom <span class="token operator">=</span> UserStackVirtualBase <span class="token operator">+</span> PageSize</span>
<span class="line">  <span class="token keyword">let</span> userStackPtr <span class="token operator">=</span> <span class="token keyword">cast</span><span class="token punctuation">[</span><span class="token keyword">ptr</span> array<span class="token punctuation">[</span><span class="token number">512</span><span class="token punctuation">,</span> uint64<span class="token punctuation">]</span><span class="token punctuation">]</span><span class="token punctuation">(</span><span class="token function">p2v</span><span class="token punctuation">(</span>userStackPhysAddr<span class="token punctuation">)</span><span class="token punctuation">)</span></span>
<span class="line">  userStackPtr<span class="token punctuation">[</span><span class="token operator">^</span><span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>DataSegmentSelector<span class="token punctuation">)</span> <span class="token comment"># SS</span></span>
<span class="line">  userStackPtr<span class="token punctuation">[</span><span class="token operator">^</span><span class="token number">2</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>userStackBottom<span class="token punctuation">)</span> <span class="token comment"># RSP</span></span>
<span class="line">  userStackPtr<span class="token punctuation">[</span><span class="token operator">^</span><span class="token number">3</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span><span class="token number">0x202</span><span class="token punctuation">)</span> <span class="token comment"># RFLAGS</span></span>
<span class="line">  userStackPtr<span class="token punctuation">[</span><span class="token operator">^</span><span class="token number">4</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>UserCodeSegmentSelector<span class="token punctuation">)</span> <span class="token comment"># CS</span></span>
<span class="line">  userStackPtr<span class="token punctuation">[</span><span class="token operator">^</span><span class="token number">5</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>UserImageVirtualBase<span class="token punctuation">)</span> <span class="token comment"># RIP</span></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;            SS: {userStackPtr[^1]:#x}&quot;</span></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;           RSP: {userStackPtr[^2]:#x}&quot;</span></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;        RFLAGS: {userStackPtr[^3]:#x}&quot;</span></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;            CS: {userStackPtr[^4]:#x}&quot;</span></span>
<span class="line">  debugln <span class="token operator">&amp;</span><span class="token string">&quot;           RIP: {userStackPtr[^5]:#x}&quot;</span></span>
<span class="line"></span>
<span class="line">  <span class="token keyword">let</span> rsp <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>userStackBottom <span class="token operator">-</span> <span class="token number">5</span> <span class="token operator">*</span> <span class="token number">8</span><span class="token punctuation">)</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Stack terminology can be confusing. The stack grows downwards, so the bottom of the stack is the highest address. This is why we set <code>userStackBottom</code> to the highest address of the stack region. Now, in order to manipulate the stack region from the kernel, we reverse map the stack&#39;s physical address to a virtual address, and cast it to a pointer to an array of 512 <code>uint64</code> values (remember that <code>UserStackVirtualBase</code> is valid only in the user page table, not the kernel page table). We then populate the five entries at the bottom of the stack, and set <code>rsp</code> to point to the top entry. This simulates pushing the interrupt stack frame on the stack.</p><h2 id="switching-to-user-mode" tabindex="-1"><a class="header-anchor" href="#switching-to-user-mode"><span>Switching to User Mode</span></a></h2><p>We&#39;re finally ready to switch to user mode. We&#39;ll activate the user page table, set the <code>rsp</code> register to point to the interrupt stack frame, and use the <code>iretq</code> instruction to switch to user mode.</p><div class="language-nim line-numbers-mode" data-highlighter="prismjs" data-ext="nim" data-title="nim"><pre><code><span class="line"><span class="token comment"># src/kernel/main.nim</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span></span>
<span class="line">  <span class="token operator">...</span></span>
<span class="line"></span>
<span class="line">  debugln <span class="token string">&quot;kernel: Switching to user mode&quot;</span></span>
<span class="line">  <span class="token function">setActivePML4</span><span class="token punctuation">(</span>upml4<span class="token punctuation">)</span></span>
<span class="line">  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;</span>
<span class="line">    mov rbp, 0</span>
<span class="line">    mov rsp, %0</span>
<span class="line">    iretq</span>
<span class="line">    :</span>
<span class="line">    : &quot;r&quot;(\`rsp\`)</span>
<span class="line">  &quot;&quot;&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we did everything correctly, we should see the following output:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">kernel: Fusion Kernel</span>
<span class="line">...</span>
<span class="line">kernel: Initializing user page table</span>
<span class="line">kernel:   Copying kernel space user page table</span>
<span class="line">kernel:   Mapping user image (1073741824 -&gt; 0x6129000)</span>
<span class="line">kernel:   Mapping user stack (0x50000000 -&gt; 0x3000)</span>
<span class="line">kernel: Creating interrupt stack frame</span>
<span class="line">            SS: 0x13</span>
<span class="line">           RSP: 0x50001000</span>
<span class="line">        RFLAGS: 0x202</span>
<span class="line">            CS: 0x1b</span>
<span class="line">           RIP: 0x40000000</span>
<span class="line">kernel: Switching to user mode</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>How do we know we&#39;re in user mode? Well, we can&#39;t really tell from the output, so let&#39;s use QEMU&#39;s monitor to check the CPU registers.</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token output">(qemu) info registers</span>
<span class="line"></span>
<span class="line">CPU#0</span>
<span class="line">RAX=0000000000000000 RBX=0000000000000000 RCX=0000000050000fc8 RDX=0000000000000000</span>
<span class="line">RSI=0000000000000001 RDI=0000000050000fc8 RBP=0000000050000ff8 RSP=0000000050000fc8</span>
<span class="line">R8 =ffff800100003c30 R9 =0000000000000001 R10=000000000636d001 R11=0000000000000004</span>
<span class="line">R12=0000000000000000 R13=0000000006bb1588 R14=0000000000000000 R15=0000000007ebf1e0</span>
<span class="line highlighted">RIP=000000004000004c RFL=00000206 [-----P-] CPL=3 II=0 A20=1 SMM=0 HLT=0</span>
<span class="line">ES =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]</span>
<span class="line highlighted">CS =001b 0000000000000000 000fffff 002ffa00 DPL=3 CS64 [-R-]</span>
<span class="line">SS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]</span>
<span class="line">DS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]</span>
<span class="line">FS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]</span>
<span class="line">GS =0013 0000000000000000 000fffff 000ff300 DPL=3 DS   [-WA]</span>
<span class="line">LDT=0000 0000000000000000 0000ffff 00008200 DPL=0 LDT</span>
<span class="line">TR =0000 0000000000000000 0000ffff 00008b00 DPL=0 TSS64-busy</span>
<span class="line">GDT=     ffff800000226290 0000001f</span>
<span class="line">IDT=     ffff8000002262b0 00000fff</span>
<span class="line">...</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We can see that <code>CPL=3</code>, which means we&#39;re in user mode! The <code>CS</code> register is <code>0x1b</code>, which is the user code segment selector (<code>0x18</code> with <code>RPL=3</code>). The <code>RIP</code> register is <code>0x4000004c</code>, which is several instructions into the <code>UserMain</code> function. Let&#39;s try to disassemble the code at the entry point.</p><div class="language-sh-session line-numbers-mode" data-highlighter="prismjs" data-ext="sh-session" data-title="sh-session"><pre><code><span class="line"><span class="token output">(qemu) x /15i 0x40000000</span>
<span class="line">0x40000000:  55                       pushq    %rbp</span>
<span class="line">0x40000001:  48 89 e5                 movq     %rsp, %rbp</span>
<span class="line">0x40000004:  48 83 ec 30              subq     $0x30, %rsp</span>
<span class="line">0x40000008:  48 b8 8b a6 00 40 00 00  movabsq  $0x4000a68b, %rax</span>
<span class="line">0x40000010:  00 00</span>
<span class="line">0x40000012:  48 89 45 d8              movq     %rax, -0x28(%rbp)</span>
<span class="line">0x40000016:  48 b8 7d a5 00 40 00 00  movabsq  $0x4000a57d, %rax</span>
<span class="line">0x4000001e:  00 00</span>
<span class="line">0x40000020:  48 89 45 e8              movq     %rax, -0x18(%rbp)</span>
<span class="line">0x40000024:  48 c7 45 e0 00 00 00 00  movq     $0, -0x20(%rbp)</span>
<span class="line">0x4000002c:  66 c7 45 f0 00 00        movw     $0, -0x10(%rbp)</span>
<span class="line">0x40000032:  48 b8 70 00 00 40 00 00  movabsq  $0x40000070, %rax</span>
<span class="line">0x4000003a:  00 00</span>
<span class="line">0x4000003c:  48 8d 7d d0              leaq     -0x30(%rbp), %rdi</span>
<span class="line">0x40000040:  ff d0                    callq    *%rax</span>
<span class="line">0x40000042:  48 c7 45 e0 06 00 00 00  movq     $6, -0x20(%rbp)</span>
<span class="line highlighted">0x4000004a:  f3 90                    pause</span>
<span class="line highlighted">0x4000004c:  e9 f9 ff ff ff           jmp      0x4000004a</span>
<span class="line"></span></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Looks like we&#39;re executing the <code>UserMain</code> function! Notice that the last two instructions are a <code>pause</code> instruction and a jump to the <code>pause</code> instruction. This is the loop we created in the <code>UserMain</code> function. We can also see that the <code>RIP</code> register is set to <code>0x4000004c</code>, which is the address of the <code>jmp</code> instruction. Everything seems to be working as expected.</p><p>This is another big milestone! We now have a minimal user mode environment. It&#39;s not very useful yet, but we&#39;ll build on it in the next section. We should look into system calls next, but before we do that, we need to allow the CPU to switch back to kernel mode. This requires something called the Task State Segment (TSS), which we&#39;ll cover in the next section.</p>`,65)]))}const c=n(i,[["render",p],["__file","16-user-mode.html.vue"]]),r=JSON.parse(`{"path":"/osdev/16-user-mode.html","title":"User Mode","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Preparing for User Mode","slug":"preparing-for-user-mode","link":"#preparing-for-user-mode","children":[]},{"level":2,"title":"User Program","slug":"user-program","link":"#user-program","children":[]},{"level":2,"title":"Loading the User Program","slug":"loading-the-user-program","link":"#loading-the-user-program","children":[]},{"level":2,"title":"User Page Table","slug":"user-page-table","link":"#user-page-table","children":[]},{"level":2,"title":"Interrupt Stack Frame","slug":"interrupt-stack-frame","link":"#interrupt-stack-frame","children":[]},{"level":2,"title":"Switching to User Mode","slug":"switching-to-user-mode","link":"#switching-to-user-mode","children":[]}],"git":{"updatedTime":1744638230000},"filePathRelative":"osdev/16-user-mode.md","excerpt":"\\n<p>Running programs in user mode is one of the most important features of an operating\\nsystem. It provides a controlled environment for programs to run in, and prevents them\\nfrom interfering with each other or the kernel. This is done by restricting the\\ninstructions that can be executed, and the memory that can be accessed. Once in user mode,\\na program can only return to kernel mode by executing a system call or through an\\ninterrupt (e.g. a timer interrupt). Even exiting the program requires a system call. We\\nwon't be implementing system calls in this section. We'll just focus on switching from\\nkernel mode to user mode. The user program won't be able to do anything useful for now,\\nbut we should have a minimal user mode environment to build on later.</p>"}`);export{c as comp,r as data};
