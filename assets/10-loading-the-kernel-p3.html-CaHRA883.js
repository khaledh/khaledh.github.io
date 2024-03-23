import{_ as n,o as s,c as e,d as a,e as t}from"./app-OxDYV5f1.js";const o="/assets/kernel-helloworld-jztaRyvT.png",i="/assets/kernel-wrong-memory-map-len-1v2_oaND.png",l="/assets/kernel-correct-memory-map-len-1o-86e_A.png",p="/assets/kernel-exceptionhandling-WOf_a8gI.png",r={},c=t(`<h1 id="loading-the-kernel-part-3" tabindex="-1"><a class="header-anchor" href="#loading-the-kernel-part-3" aria-hidden="true">#</a> Loading the Kernel (Part 3)</h1><p>Now that the bootloader exited UEFI Boot Services, it&#39;s time to transfer control to the kernel. This part should be fairly straightforward. We&#39;ll define a <code>KernelEntryPoint</code> proc type that matches the signature of the <code>KernelMain</code> proc, and use it to call the kernel entry point. Remember that we cannot print to the console anymore, since we exited the Boot Services.</p><p>First let&#39;s recall the <code>KernelMain</code> proc definition:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">import</span> common<span class="token operator">/</span><span class="token punctuation">[</span>libc<span class="token punctuation">,</span> malloc<span class="token punctuation">]</span>
<span class="token keyword">import</span> debugcon

<span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span>

<span class="token keyword">proc</span> <span class="token function">KernelMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  debugln <span class="token string">&quot;Hello, world!&quot;</span>
  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>It&#39;s a simple proc that doesn&#39;t take any arguments (for now) and doesn&#39;t return anything. Let&#39;s define its type, cast the kernel address to that type, and call it.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">type</span>
  KernelEntryPoint <span class="token operator">=</span> <span class="token function">proc</span> <span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># jump to kernel</span>
  <span class="token keyword">let</span> kernelMain <span class="token operator">=</span> <span class="token function">cast[KernelEntryPoint]</span><span class="token punctuation">(</span>kernelImageBase<span class="token punctuation">)</span>
  <span class="token function">kernelMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token comment"># we should never get here</span>
  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we compile and run now, we should see the following output in the terminal (not in the QEMU window, since the kernel is printing to the QEMU debug console):</p><p><img src="`+o+`" alt="Kernel - Hello world"></p><p>Great! Our kernel is running! This is a big milestone. But we&#39;re not done with the bootloader handover yet. We still need to pass the memory map from the bootloader to the kernel (and later a few other things). We&#39;ll use this memory map later to implement a physical memory manager in the kernel.</p><h2 id="convert-uefi-memory-map" tabindex="-1"><a class="header-anchor" href="#convert-uefi-memory-map" aria-hidden="true">#</a> Convert UEFI memory map</h2><p>Ideally we shouldn&#39;t pass the UEFI memory map as is to the kernel. The memory map is a UEFI-specific data structure, and we don&#39;t want to tie the kernel to UEFI. Instead, we&#39;ll create our own memory map data structure that is independent of UEFI, and pass that to the kernel. Since this is going to be a data structure used by both the bootloader and the kernel, let&#39;s put it under the <code>common</code> folder in a module called <code>bootinfo.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/bootinfo.nim</span>

<span class="token keyword">type</span>
  MemoryType<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">enum</span>
    Free
    KernelImage
    KernelStack
    KernelBootInfo
    Reserved

  MemoryMapEntry<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token identifier"><span class="token punctuation">\`</span>type<span class="token punctuation">\`</span></span><span class="token operator">*:</span> MemoryType
    start<span class="token operator">*:</span> uint64
    nframes<span class="token operator">*:</span> uint64

  MemoryMap<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    len<span class="token operator">*:</span> uint
    entries<span class="token operator">*:</span> <span class="token keyword">ptr</span> UncheckedArray<span class="token punctuation">[</span>MemoryMapEntry<span class="token punctuation">]</span>

  BootInfo<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    physicalMemoryMap<span class="token operator">*:</span> MemoryMap
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s also add a proc in the bootloader to convert the UEFI memory map to our boot info memory map.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">import</span> std<span class="token operator">/</span>sets
<span class="token operator">...</span>

<span class="token comment"># We use a HashSet here because the \`EfiMemoryType\` has values greater than 64K,</span>
<span class="token comment"># which is the maximum value supported by Nim sets.</span>
<span class="token keyword">const</span>
  FreeMemoryTypes <span class="token operator">=</span> <span class="token punctuation">[</span>
    EfiConventionalMemory<span class="token punctuation">,</span>
    EfiBootServicesCode<span class="token punctuation">,</span>
    EfiBootServicesData<span class="token punctuation">,</span>
    EfiLoaderCode<span class="token punctuation">,</span>
    EfiLoaderData<span class="token punctuation">,</span>
  <span class="token punctuation">]</span><span class="token operator">.</span>toHashSet

<span class="token keyword">proc</span> <span class="token function">convertUefiMemoryMap</span><span class="token punctuation">(</span>
  uefiMemoryMap<span class="token operator">:</span> <span class="token keyword">ptr</span> UncheckedArray<span class="token punctuation">[</span>EfiMemoryDescriptor<span class="token punctuation">]</span><span class="token punctuation">,</span>
  uefiMemoryMapSize<span class="token operator">:</span> uint<span class="token punctuation">,</span>
  uefiMemoryMapDescriptorSize<span class="token operator">:</span> uint<span class="token punctuation">,</span>
<span class="token punctuation">)</span><span class="token operator">:</span> seq<span class="token punctuation">[</span>MemoryMapEntry<span class="token punctuation">]</span> <span class="token operator">=</span>
  <span class="token keyword">let</span> uefiNumMemoryMapEntries <span class="token operator">=</span> uefiMemoryMapSize <span class="token operator">div</span> uefiMemoryMapDescriptorSize

  <span class="token keyword">for</span> i <span class="token operator">in</span> <span class="token number">0</span> <span class="token operator">..&lt;</span> uefiNumMemoryMapEntries<span class="token operator">:</span>
    <span class="token keyword">let</span> uefiEntry <span class="token operator">=</span> <span class="token function">cast[ptr EfiMemoryDescriptor]</span><span class="token punctuation">(</span>
      <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>uefiMemoryMap<span class="token punctuation">)</span> <span class="token operator">+</span> i <span class="token operator">*</span> uefiMemoryMapDescriptorSize
    <span class="token punctuation">)</span>
    <span class="token keyword">let</span> memoryType <span class="token operator">=</span>
      <span class="token keyword">if</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">in</span> FreeMemoryTypes<span class="token operator">:</span>
        Free
      <span class="token keyword">elif</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> OsvKernelCode<span class="token operator">:</span>
        KernelCode
      <span class="token keyword">elif</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> OsvKernelData<span class="token operator">:</span>
        KernelData
      <span class="token keyword">elif</span> uefiEntry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> OsvKernelStack<span class="token operator">:</span>
        KernelStack
      <span class="token keyword">else</span><span class="token operator">:</span>
        Reserved
    result<span class="token operator">.</span><span class="token function">add</span><span class="token punctuation">(</span><span class="token function">MemoryMapEntry</span><span class="token punctuation">(</span>
      <span class="token keyword">type</span><span class="token operator">:</span> memoryType<span class="token punctuation">,</span>
      start<span class="token operator">:</span> uefiEntry<span class="token operator">.</span>physicalStart<span class="token punctuation">,</span>
      nframes<span class="token operator">:</span> uefiEntry<span class="token operator">.</span>numberOfPages
    <span class="token punctuation">)</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>In order to pass the memory map to the kernel, it may seem that we can just pass a <code>BootInfo</code> instance to the kernel entry point. But keep in mind that the boot memory map is currently allocated both on the stack and the heap (the <code>entries</code> array) of the bootloader. We don&#39;t want the kernel to depend on memory in the bootloader, as we&#39;ll consider this memory as available once we&#39;re in the kernel. So, what we can do is use the UEFI <code>AllocatePool</code> method to allocate a single page of memory, use it to initialize a <code>BootInfo</code> instance, and pass its address to the kernel. We&#39;ll use memory type <code>OsvKernelData</code> for this memory, since it&#39;s memory that will be used by the kernel.</p><p>Let&#39;s add this part to the <code>EfiMainInner</code> proc:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  consoleOut <span class="token operator">&amp;</span><span class="token string">&quot;boot: Allocating memory for kernel stack (16 KiB)&quot;</span>
  <span class="token operator">...</span>

  consoleOut <span class="token operator">&amp;</span><span class="token string">&quot;boot: Allocating memory for BootInfo&quot;</span>
  <span class="token keyword">var</span> bootInfoBase<span class="token operator">:</span> uint64
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">allocatePages</span><span class="token punctuation">(</span>
    AllocateAnyPages<span class="token punctuation">,</span>
    OsvKernelData<span class="token punctuation">,</span>
    <span class="token number">1</span><span class="token punctuation">,</span>
    bootInfoBase<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">,</span>
  <span class="token punctuation">)</span>

  consoleOut <span class="token string">&quot;boot: Reading kernel into memory&quot;</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, let&#39;s conver the UEFI memory map to the boot memory map using the <code>convertUefiMemoryMap</code> proc, and manually copy it to the <code>BootInfo</code> memory we just allocated:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># ======= NO MORE UEFI BOOT SERVICES =======</span>

  <span class="token keyword">let</span> physMemoryMap <span class="token operator">=</span> <span class="token function">convertUefiMemoryMap</span><span class="token punctuation">(</span>memoryMap<span class="token punctuation">,</span> memoryMapSize<span class="token punctuation">,</span> memoryMapDescriptorSize<span class="token punctuation">)</span>

  <span class="token keyword">var</span> bootInfo <span class="token operator">=</span> <span class="token function">cast[ptr BootInfo]</span><span class="token punctuation">(</span>bootInfoBase<span class="token punctuation">)</span>

  <span class="token comment"># copy physical memory map entries to boot info</span>
  bootInfo<span class="token operator">.</span>physicalMemoryMap<span class="token operator">.</span>len <span class="token operator">=</span> physMemoryMap<span class="token operator">.</span>len<span class="token operator">.</span>uint
  bootInfo<span class="token operator">.</span>physicalMemoryMap<span class="token operator">.</span>entries <span class="token operator">=</span>
    <span class="token keyword">cast</span><span class="token punctuation">[</span><span class="token keyword">ptr</span> UncheckedArray<span class="token punctuation">[</span>MemoryMapEntry<span class="token punctuation">]</span><span class="token punctuation">]</span><span class="token punctuation">(</span>bootInfoBase <span class="token operator">+</span> <span class="token function">sizeof</span><span class="token punctuation">(</span>BootInfo<span class="token punctuation">)</span><span class="token operator">.</span>uint64<span class="token punctuation">)</span>
  <span class="token keyword">for</span> i <span class="token operator">in</span> <span class="token number">0</span> <span class="token operator">..&lt;</span> physMemoryMap<span class="token operator">.</span>len<span class="token operator">:</span>
    bootInfo<span class="token operator">.</span>physicalMemoryMap<span class="token operator">.</span>entries<span class="token punctuation">[</span>i<span class="token punctuation">]</span> <span class="token operator">=</span> physMemoryMap<span class="token punctuation">[</span>i<span class="token punctuation">]</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>What we&#39;re doing here is treating the start of the boot info page as a <code>BootInfo</code> instance. On line 12 &amp; 13, we&#39;re pointing the <code>entries</code> field of the boot info memory map to the memory right after the boot info instance (instead of to some arbitrary heap memory). The last part just copies the entries from the original memory map to the boot info memory map.</p><h2 id="pass-bootinfo-to-kernel" tabindex="-1"><a class="header-anchor" href="#pass-bootinfo-to-kernel" aria-hidden="true">#</a> Pass BootInfo to kernel</h2><p>We&#39;re now ready to pass our memory map the kernel. We&#39;ll change the signature of the <code>KernelMain</code> proc to take a <code>ptr BootInfo</code>. Let&#39;s change the <code>KernelMain</code> proc signature, and print the memory map length to the debug console to verify that we&#39;re getting the correct info.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">import</span> debugcon
<span class="token keyword">import</span> common<span class="token operator">/</span><span class="token punctuation">[</span>bootinfo<span class="token punctuation">,</span> libc<span class="token punctuation">,</span> malloc<span class="token punctuation">]</span>

<span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span>

<span class="token keyword">proc</span> <span class="token function">KernelMain</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;kernel: Memory map length: {bootinfo.physicalMemoryMap.len}&quot;</span>

  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>In the bootloader, we&#39;ll change the <code>KernelEntryPoint</code> type to match the new signature, convert the memory map, and pass it to the kernel through the <code>bootinfo</code> argument.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">import</span> common<span class="token operator">/</span>bootinfo
<span class="token operator">...</span>

<span class="token keyword">type</span>
  KernelEntryPoint <span class="token operator">=</span> <span class="token function">proc</span> <span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># jump to kernel</span>
  <span class="token keyword">let</span> kernelMain <span class="token operator">=</span> <span class="token function">cast[KernelEntryPoint]</span><span class="token punctuation">(</span>kernelImageBase<span class="token punctuation">)</span>
  <span class="token function">kernelMain</span><span class="token punctuation">(</span>bootInfo<span class="token punctuation">)</span>

  <span class="token comment"># we should never get here</span>
  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s compile and run:</p><p><img src="`+i+`" alt="Kernel - Wrong memory map length"></p><p>Well, that didn&#39;t work as expected. We&#39;re getting a memory map length of <code>0</code>. This one actually took me a long while to figure out. The problem, it turns out, is a difference in the calling convention between the bootloader and the kernel.</p><h2 id="calling-convention" tabindex="-1"><a class="header-anchor" href="#calling-convention" aria-hidden="true">#</a> Calling convention</h2><p>Remember that the bootloader is compiled for the target <code>x86_64-unknown-windows</code>, and the kernel is compiled for <code>x86_64-unknown-elf</code>. This basically means that the bootloader is using the Microsoft x64 ABI, and the kernel is using the System V x64 ABI. Those two ABIs have different calling conventions; they pass parameters in different registers. The Microsoft x64 ABI passes the first four parameters in <code>rcx</code>, <code>rdx</code>, <code>r8</code>, and <code>r9</code>, whereas the System V x64 ABI passes the first six parameters in <code>rdi</code>, <code>rsi</code>, <code>rdx</code>, <code>rcx</code>, <code>r8</code>, and <code>r9</code>. So the bootloader is passing the memory map size in <code>rdx</code> (second parameter), but the kernel is expecting it in <code>rsi</code>. This is why we&#39;re getting a memory map size of <code>0</code>.</p><p>So how do we fix this? Ideally we can annotate the <code>KernelEntryPoint</code> type with the proper calling convention, but unfortunately Nim doesn&#39;t define a calling convention for the System V x64 ABI. So we have to take matters in our hands. One solution is emit some C code from Nim that allows us to define the entry point function type with the proper calling convention. The C compiler supports the Sys V ABI by annotating a function with <code>__attribute__((sysv_abi))</code>. But that&#39;s a bit too much for something simple.</p><p>Keep in mind that we also need to set up the kernel stack and switch to it before jumping to the kernel, and in a future section we&#39;ll also need to set up the kernel page tables and switch to them. So we&#39;ll need to write some assembly code anyway. Let&#39;s go ahead and do that. We&#39;ll pass the boot info address in <code>rdi</code> (first parameter), and we&#39;ll change the <code>rsp</code> register to point to the top of the kernel stack region. Finally we&#39;ll <code>jmp</code> to the kernel entry point.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># switch stacks and jump to kernel</span>
  <span class="token keyword">let</span> kernelStackTop <span class="token operator">=</span> kernelStackBase <span class="token operator">+</span> KernelStackSize
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rdi, %0  # bootInfo
    mov rsp, %1  # kernel stack top
    jmp %2       # kernel entry point
    :
    : &quot;r&quot;(\`bootInfoBase\`),
      &quot;r&quot;(\`kernelStackTop\`),
      &quot;r&quot;(\`KernelPhysicalBase\`)
  &quot;&quot;&quot;</span>

  <span class="token comment"># we should never get here</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s compile and run:</p><p><img src="`+l+`" alt="Kernel - Correct memory map length"></p><p>Success! This time we&#39;re getting the correct memory map length.</p><h2 id="print-memory-map" tabindex="-1"><a class="header-anchor" href="#print-memory-map" aria-hidden="true">#</a> Print memory map</h2><p>Just to be sure, let&#39;s iterate over the memory map and print the memory type, start address, and number of pages of each entry. We&#39;ll also print the total size of free memory.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">KernelMain</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> BootInfo<span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span>

  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;Memory Map ({bootInfo.physicalMemoryMap.len} entries):&quot;</span>
  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;Entry&quot;}&quot;&quot;&quot;</span>
  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;Type&quot;:12}&quot;&quot;&quot;</span>
  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;Start&quot;:&gt;12}&quot;&quot;&quot;</span>
  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;Start (KB)&quot;:&gt;15}&quot;&quot;&quot;</span>
  debug <span class="token operator">&amp;</span><span class="token string">&quot;&quot;&quot;   {&quot;#Pages&quot;:&gt;10}&quot;&quot;&quot;</span>
  debugln <span class="token string">&quot;&quot;</span>

  totalFreePages <span class="token operator">=</span> <span class="token number">0</span>
  <span class="token keyword">for</span> i <span class="token operator">in</span> <span class="token number">0</span> <span class="token operator">..&lt;</span> bootInfo<span class="token operator">.</span>physicalMemoryMap<span class="token operator">.</span>len<span class="token operator">:</span>
    <span class="token keyword">let</span> entry <span class="token operator">=</span> bootInfo<span class="token operator">.</span>physicalMemoryMap<span class="token operator">.</span>entries<span class="token punctuation">[</span>i<span class="token punctuation">]</span>
    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {i:&gt;5}&quot;</span>
    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {entry.type:12}&quot;</span>
    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {entry.start:&gt;#12x}&quot;</span>
    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {entry.start div 1024:&gt;#15}&quot;</span>
    debug <span class="token operator">&amp;</span><span class="token string">&quot;   {entry.nframes:&gt;#10}&quot;</span>
    debugln <span class="token string">&quot;&quot;</span>
    <span class="token keyword">if</span> entry<span class="token operator">.</span><span class="token keyword">type</span> <span class="token operator">==</span> MemoryType<span class="token operator">.</span>Free<span class="token operator">:</span>
      totalFreePages <span class="token operator">+=</span> entry<span class="token operator">.</span>nframes

  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;Total free: {totalFreePages * 4} KiB ({totalFreePages * 4 div 1024} MiB)&quot;</span>

  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We should see the following output in the debug console:</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Fusion Kernel

Memory Map (109 entries):
   Entry   Type                  Start        Start (KB)       #Pages
       0   Free                    0x0                 0            1
       1   Free                 0x1000                 4          159
       2   KernelCode         0x100000              1024          290
       3   Free               0x222000              2184         1502
       4   Reserved           0x800000              8192            8
       5   Free               0x808000              8224            3
       6   Reserved           0x80b000              8236            1
       7   Free               0x80c000              8240            4
       8   Reserved           0x810000              8256          240
       9   Free               0x900000              9216         3712
      10   Free              0x1780000             24064         9205
      11   Free              0x3b75000             60884           32
      12   Free              0x3b95000             61012         9887
      13   Free              0x6234000            100560          292
      14   Free              0x6358000            101728           19
      15   Free              0x636b000            101804            2
      16   KernelData        0x636d000            101812            1
      17   KernelStack       0x636e000            101816            4
      18   Free              0x6372000            101832         1781
      19   Free              0x6a67000            108956           25
      20   Free              0x6a80000            109056            2
      ...
      99   Free              0x7e00000            129024          135
     100   Free              0x7e87000            129564           32
     101   Free              0x7ea7000            129692           35
     102   Free              0x7eca000            129832           17
     103   Free              0x7edb000            129900           25
     104   Reserved          0x7ef4000            130000          132
     105   Reserved          0x7f78000            130528          136
     106   Reserved         0xe0000000           3670016        65536
     107   Reserved         0xffc00000           4190208         1024
     108   Reserved       0xfd00000000        1061158912      3145728

Total free: 124296 KiB (121 MiB)
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The memory map looks good. Notice that the kernel memory regions are marked properly.</p><h2 id="handling-nim-exceptions" tabindex="-1"><a class="header-anchor" href="#handling-nim-exceptions" aria-hidden="true">#</a> Handling Nim exceptions</h2><p>Before we move on to the next section, let&#39;s make sure we handle Nim exceptions properly at the top level of the kernel, similar to what we did with the bootloader. Let&#39;s define an <code>unhandledException</code> proc that prints the exception and stack trace and quits, and move the code in <code>KernelMain</code> to a new <code>KernelMainInner</code> proc.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>
<span class="token operator">...</span>

<span class="token comment"># forward declarations</span>
<span class="token keyword">proc</span> <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span>
<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> BootInfo<span class="token punctuation">)</span>
<span class="token keyword">proc</span> <span class="token function">unhandledException<span class="token operator">*</span></span><span class="token punctuation">(</span>e<span class="token operator">:</span> <span class="token keyword">ref</span> Exception<span class="token punctuation">)</span>

<span class="token keyword">proc</span> <span class="token function">KernelMain</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> BootInfo<span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token function">NimMain</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token keyword">try</span><span class="token operator">:</span>
    <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token punctuation">)</span>
  <span class="token keyword">except</span> Exception <span class="token keyword">as</span> e<span class="token operator">:</span>
    <span class="token function">unhandledException</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span>

  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;kernel: Fusion Kernel&quot;</span>
  <span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">unhandledException<span class="token operator">*</span></span><span class="token punctuation">(</span>e<span class="token operator">:</span> <span class="token keyword">ref</span> Exception<span class="token punctuation">)</span> <span class="token operator">=</span>
  debugln <span class="token string">&quot;&quot;</span>
  debugln <span class="token operator">&amp;</span><span class="token string">&quot;Unhandled exception: {e.msg} [{e.name}]&quot;</span>
  <span class="token keyword">if</span> e<span class="token operator">.</span>trace<span class="token operator">.</span>len <span class="token operator">&gt;</span> <span class="token number">0</span><span class="token operator">:</span>
    debugln <span class="token string">&quot;&quot;</span>
    debugln <span class="token string">&quot;Stack trace:&quot;</span>
    debugln <span class="token function">getStackTrace</span><span class="token punctuation">(</span>e<span class="token punctuation">)</span>
  <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s test this by forcing an exception in <code>KernelMainInner</code>:</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token comment"># force an IndexDefect exception</span>
  <span class="token keyword">let</span> a <span class="token operator">=</span> <span class="token punctuation">[</span><span class="token number">1</span><span class="token punctuation">,</span> <span class="token number">2</span><span class="token punctuation">,</span> <span class="token number">3</span><span class="token punctuation">]</span>
  <span class="token keyword">let</span> n <span class="token operator">=</span> <span class="token number">5</span>
  <span class="token keyword">discard</span> a<span class="token punctuation">[</span>n<span class="token punctuation">]</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We should see the following output in the debug console:</p><p><img src="`+p+'" alt="Kernel - Exception handling"></p><p>Great! We&#39;re in a great place now. We can now switch our focus to the kernel, assuming full control of the system.</p><p>So where do we go from here? Ultimately we want to be able to run user programs in user space. This requires virtual memory support (using paging), where we divide the address space into two parts: the kernel space and the user space. Virtual memory requires a physical memory manager in order to allocate (and free) physical memory frames to back virtual memory pages. We already have a physical memory map, so we can use that to implement a physical memory manager. We&#39;ll do that in the next section.</p>',51);function d(u,v){return s(),e("div",null,[c,a(` TODO: move
In the next section, we'll take a closer look at the virtual address space, and how to map the kernel into a dedicated part of the virtual address space (the higher half), the so-called _kernel space_.
`)])}const k=n(r,[["render",d],["__file","10-loading-the-kernel-p3.html.vue"]]);export{k as default};
