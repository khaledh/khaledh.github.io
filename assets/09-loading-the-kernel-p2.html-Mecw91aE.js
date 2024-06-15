import{_ as s,o as n,c as a,e}from"./app-IpIrRMej.js";const i="/assets/boot-closefiles-hPVvr10r.png",t="/assets/boot-getmemorymap-zeMpkCFK.png",o="/assets/boot-exitbootserviceserror-2Yc9qmOl.png",l="/assets/boot-exitbootservices-7dkZcdaK.png",c={},p=e(`<h1 id="loading-the-kernel-part-2" tabindex="-1"><a class="header-anchor" href="#loading-the-kernel-part-2" aria-hidden="true">#</a> Loading the Kernel (Part 2)</h1><p>In the previous section, we were able to locate the kernel image and get its size. In this section, we&#39;ll continue with our plan. We&#39;ll allocate memory for the kernel image, read it into memory, exit the Boot Services, and jump to the kernel image.</p><h2 id="allocate-memory" tabindex="-1"><a class="header-anchor" href="#allocate-memory" aria-hidden="true">#</a> Allocate memory</h2><p>We&#39;ll use the Boot Services <code>AllocatePages</code> function to allocate enough pages, starting at address <code>0x100000</code> (1 MiB), to hold the kernel image. We&#39;ll also allocate a region of memory for the kernel stack. Let&#39;s define the <code>AllocatePages</code> function, which also requires defining the <code>EfiAllocateType</code> and <code>EfiPhysicalAddress</code> types.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiBootServices<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token operator">...</span>
    allocatePages<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>
        allocateType<span class="token operator">:</span> EfiAllocateType<span class="token punctuation">,</span>
        memoryType<span class="token operator">:</span> EfiMemoryType<span class="token punctuation">,</span>
        pages<span class="token operator">:</span> uint<span class="token punctuation">,</span>
        memory<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiPhysicalAddress
      <span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
    <span class="token operator">...</span>

  EfiAllocateType<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">enum</span>
    AllocateAnyPages<span class="token punctuation">,</span>
    AllocateMaxAddress<span class="token punctuation">,</span>
    AllocateAddress<span class="token punctuation">,</span>
    MaxAllocateType

  EfiPhysicalAddress<span class="token operator">*</span> <span class="token operator">=</span> uint64
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The <code>EfiAllocateType</code> enum is used to specify the type of allocation. We&#39;ll use <code>AllocateAddress</code> to allocate pages for the kernel image, starting at a specific address (in our case, <code>0x100000</code>). The <code>EfiMemoryType</code> enum is used to specify the type of memory to allocate, which we&#39;ll set to <code>OsvKernelCode</code>. For the kernel stack, we&#39;ll use <code>AllocateAnyPages</code> to allocate any pages, and set the memory type to <code>OsvKernelStack</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">const</span>
  PageSize <span class="token operator">=</span> <span class="token number">4096</span>
  KernelPhysicalBase <span class="token operator">=</span> <span class="token number">0x100000</span>
  KernelStackSize <span class="token operator">=</span> <span class="token number">128</span> <span class="token operator">*</span> <span class="token number">1024&#39;u64</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  consoleOut <span class="token operator">&amp;</span><span class="token string">&quot;boot: Allocating memory for kernel image &quot;</span>
  <span class="token keyword">let</span> kernelImageBase <span class="token operator">=</span> <span class="token function">cast[pointer]</span><span class="token punctuation">(</span>KernelPhysicalBase<span class="token punctuation">)</span>
  <span class="token keyword">let</span> kernelImagePages <span class="token operator">=</span> <span class="token punctuation">(</span>kernelInfo<span class="token operator">.</span>fileSize <span class="token operator">+</span> <span class="token number">0xFFF</span><span class="token punctuation">)</span><span class="token operator">.</span>uint <span class="token operator">div</span> PageSize<span class="token operator">.</span>uint <span class="token comment"># round up to nearest page</span>
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">allocatePages</span><span class="token punctuation">(</span>
    AllocateAddress<span class="token punctuation">,</span>
    OsvKernelCode<span class="token punctuation">,</span>
    kernelImagePages<span class="token punctuation">,</span>
    <span class="token function">cast[ptr EfiPhysicalAddress]</span><span class="token punctuation">(</span><span class="token keyword">addr</span> kernelImageBase<span class="token punctuation">)</span>
  <span class="token punctuation">)</span>

  consoleOut <span class="token operator">&amp;</span><span class="token string">&quot;boot: Allocating memory for kernel stack (16 KiB) &quot;</span>
  <span class="token keyword">var</span> kernelStackBase<span class="token operator">:</span> uint64
  <span class="token keyword">let</span> kernelStackPages <span class="token operator">=</span> KernelStackSize <span class="token operator">div</span> PageSize
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">allocatePages</span><span class="token punctuation">(</span>
    AllocateAnyPages<span class="token punctuation">,</span>
    OsvKernelStack<span class="token punctuation">,</span>
    kernelStackPages<span class="token punctuation">,</span>
    kernelStackBase<span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">,</span>
  <span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="read-kernel-image" tabindex="-1"><a class="header-anchor" href="#read-kernel-image" aria-hidden="true">#</a> Read kernel image</h2><p>The next step is to use the <code>read</code> function of the <code>EfiFileProtocol</code> to read the kernel image into memory. Let&#39;s define the <code>read</code> function.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiFileProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token operator">...</span>
    read<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>
        this<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol<span class="token punctuation">,</span>
        bufferSize<span class="token operator">:</span> <span class="token keyword">ptr</span> uint<span class="token punctuation">,</span>
        buffer<span class="token operator">:</span> pointer
      <span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;ll use the <code>read</code> function to read the kernel image into the memory we allocated earlier.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># read the kernel into memory</span>
  consoleOut <span class="token string">&quot;boot: Reading kernel into memory&quot;</span>
  checkStatus kernelFile<span class="token operator">.</span><span class="token function">read</span><span class="token punctuation">(</span>kernelFile<span class="token punctuation">,</span> <span class="token function">cast[ptr uint]</span><span class="token punctuation">(</span><span class="token keyword">addr</span> kernelInfo<span class="token operator">.</span>fileSize<span class="token punctuation">)</span><span class="token punctuation">,</span> kernelImageBase<span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="close-open-files" tabindex="-1"><a class="header-anchor" href="#close-open-files" aria-hidden="true">#</a> Close open files</h2><p>We&#39;re done with the kernel file and the root directory, so we can close them. It&#39;s not strictly needed, but I got in the habbit of closing resources when I&#39;m done with them. Let&#39;s define the <code>close</code> function of the <code>EfiFileProtocol</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiFileProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token operator">...</span>
    close<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>this<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
    <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># close the kernel file</span>
  consoleOut <span class="token string">&quot;boot: Closing kernel file&quot;</span>
  checkStatus kernelFile<span class="token operator">.</span><span class="token function">close</span><span class="token punctuation">(</span>kernelFile<span class="token punctuation">)</span>

  <span class="token comment"># close the root directory</span>
  consoleOut <span class="token string">&quot;boot: Closing root directory&quot;</span>
  checkStatus rootDir<span class="token operator">.</span><span class="token function">close</span><span class="token punctuation">(</span>rootDir<span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><img src="`+i+`" alt="Boot - Close files"></p><h2 id="get-memory-map" tabindex="-1"><a class="header-anchor" href="#get-memory-map" aria-hidden="true">#</a> Get memory map</h2><p>In order to get the memory map, we have to allocate memory for the map itself. But how do we know how much memory to allocate? Calling <code>getMemoryMap</code> with a buffer size of <code>0</code> will return the required buffer size in the <code>memoryMapSize</code> output parameter. We can then allocate the required memory and call <code>getMemoryMap</code> again to get the actual memory map.</p><p>Let&#39;s define the <code>getMemoryMap</code> function first (and the associated <code>EfiMemoryDescriptor</code> and <code>EfiVirtualAddress</code> types). We&#39;ll also define the <code>allocatePool</code> function of the <code>EfiBootServices</code> type, which we&#39;ll use to allocate the memory for the memory map. (The difference between <code>allocatePages</code> and <code>allocatePool</code> is that <code>allocatePages</code> allocates memory in page-sized chunks, whereas <code>allocatePool</code> allocates memory in byte-sized chunks. <code>allocatePool</code> also provides more control over the address of the allocated memory, which is why we used it to allocate memory for the kernel.)</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiBootServices<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token operator">...</span>
    getMemoryMap<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>
        memoryMapSize<span class="token operator">:</span> <span class="token keyword">ptr</span> uint<span class="token punctuation">,</span>
        memoryMap<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiMemoryDescriptor<span class="token punctuation">,</span>
        mapKey<span class="token operator">:</span> <span class="token keyword">ptr</span> uint<span class="token punctuation">,</span>
        descriptorSize<span class="token operator">:</span> <span class="token keyword">ptr</span> uint<span class="token punctuation">,</span>
        descriptorVersion<span class="token operator">:</span> <span class="token keyword">ptr</span> uint32
      <span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
    allocatePool<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>
        poolType<span class="token operator">:</span> EfiMemoryType<span class="token punctuation">,</span>
        size<span class="token operator">:</span> uint<span class="token punctuation">,</span>
        buffer<span class="token operator">:</span> <span class="token keyword">ptr</span> pointer
      <span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
    <span class="token operator">...</span>

  EfiMemoryDescriptor<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token identifier"><span class="token punctuation">\`</span>type<span class="token punctuation">\`</span></span><span class="token operator">*:</span> EfiMemoryType
    physicalStart<span class="token operator">*:</span> EfiPhysicalAddress
    virtualStart<span class="token operator">*:</span> EfiVirtualAddress
    numberOfPages<span class="token operator">*:</span> uint64
    attribute<span class="token operator">*:</span> uint64
  <span class="token operator">...</span>

  EfiPhysicalAddress<span class="token operator">*</span> <span class="token operator">=</span> uint64
  EfiVirtualAddress<span class="token operator">*</span> <span class="token operator">=</span> uint64
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we&#39;re ready to get the memory map.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># memory map</span>
  <span class="token keyword">var</span> memoryMapSize <span class="token operator">=</span> <span class="token number">0.u</span>int
  <span class="token keyword">var</span> memoryMap<span class="token operator">:</span> <span class="token keyword">ptr</span> UncheckedArray<span class="token punctuation">[</span>EfiMemoryDescriptor<span class="token punctuation">]</span>
  <span class="token keyword">var</span> memoryMapKey<span class="token operator">:</span> uint
  <span class="token keyword">var</span> memoryMapDescriptorSize<span class="token operator">:</span> uint
  <span class="token keyword">var</span> memoryMapDescriptorVersion<span class="token operator">:</span> uint32

  <span class="token comment"># get memory map size</span>
  status <span class="token operator">=</span> uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">getMemoryMap</span><span class="token punctuation">(</span>
    <span class="token keyword">addr</span> memoryMapSize<span class="token punctuation">,</span>
    <span class="token function">cast[ptr EfiMemoryDescriptor]</span><span class="token punctuation">(</span><span class="token keyword">nil</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">cast[ptr uint]</span><span class="token punctuation">(</span><span class="token keyword">nil</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">cast[ptr uint]</span><span class="token punctuation">(</span><span class="token keyword">addr</span> memoryMapDescriptorSize<span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token function">cast[ptr uint32]</span><span class="token punctuation">(</span><span class="token keyword">nil</span><span class="token punctuation">)</span>
  <span class="token punctuation">)</span>
  <span class="token comment"># increase memory map size to account for the next call to allocatePool</span>
  inc memoryMapSize<span class="token punctuation">,</span> memoryMapDescriptorSize

  <span class="token comment"># allocate pool for memory map (this changes the memory map size, hence the previous step)</span>
  consoleOut <span class="token string">&quot;boot: Allocating pool for memory map&quot;</span>
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">allocatePool</span><span class="token punctuation">(</span>
    EfiLoaderData<span class="token punctuation">,</span> memoryMapSize<span class="token punctuation">,</span> <span class="token function">cast[ptr pointer]</span><span class="token punctuation">(</span><span class="token keyword">addr</span> memoryMap<span class="token punctuation">)</span>
  <span class="token punctuation">)</span>

  <span class="token comment"># now get the memory map</span>
  consoleOut <span class="token string">&quot;boot: Getting memory map&quot;</span>
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">getMemoryMap</span><span class="token punctuation">(</span>
    <span class="token keyword">addr</span> memoryMapSize<span class="token punctuation">,</span>
    <span class="token function">cast[ptr EfiMemoryDescriptor]</span><span class="token punctuation">(</span>memoryMap<span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token keyword">addr</span> memoryMapKey<span class="token punctuation">,</span>
    <span class="token keyword">addr</span> memoryMapDescriptorSize<span class="token punctuation">,</span>
    <span class="token keyword">addr</span> memoryMapDescriptorVersion
  <span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p><img src="`+t+`" alt="Boot - Get memory map"></p><h2 id="exit-boot-services" tabindex="-1"><a class="header-anchor" href="#exit-boot-services" aria-hidden="true">#</a> Exit boot services</h2><p>We have all the information we need to exit the Boot Services. Let&#39;s define the <code>exitBootServices</code> function.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiBootServices<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token operator">...</span>
    exitBootServices<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>
        imageHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span>
        mapKey<span class="token operator">:</span> uint
      <span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
    <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The call to <code>exitBootServices</code> requires passing the <code>mapKey</code> that we got from <code>getMemoryMap</code>. This ensures that the memory map hasn&#39;t changed since we got it, otherwise the call will fail.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># exit boot services</span>
  consoleOut <span class="token string">&quot;boot: Exiting boot services&quot;</span>
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">exitBootServices</span><span class="token punctuation">(</span>imgHandle<span class="token punctuation">,</span> memoryMapKey<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we compile and run now, we are faced with the following error:</p><p><img src="`+o+`" alt="Boot - Exit boot services error"></p><p>Status code 2 is <code>EfiInvalidParameter</code>, which means that the <code>mapKey</code> we passed to <code>exitBootServices</code> is invalid. How can the <code>mapKey</code> be invalid if we just got it from <code>getMemoryMap</code>? This took me a while to figure out, but it turns out that merely printing to the console (or any other boot service call) may allocate memory, which changes the memory map. So basically we have to call <code>exitBootServices</code> immediately after getting the memory map, without calling any other boot service function in between. So, unfortunately, we&#39;ll have to give up printing to the console from that point on, until we transfer control to the kernel.</p><p>Let&#39;s change the call to <code>checkStatus</code> to avoid printing to the console (we&#39;ll only print to the console in case of an error).</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># get memory map</span>
  echo <span class="token string">&quot;boot: Getting memory map and exiting boot services&quot;</span>
  status <span class="token operator">=</span> uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">getMemoryMap</span><span class="token punctuation">(</span>
    <span class="token keyword">addr</span> memoryMapSize<span class="token punctuation">,</span>
    <span class="token function">cast[ptr EfiMemoryDescriptor]</span><span class="token punctuation">(</span>memoryMap<span class="token punctuation">)</span><span class="token punctuation">,</span>
    <span class="token keyword">addr</span> memoryMapKey<span class="token punctuation">,</span>
    <span class="token keyword">addr</span> memoryMapDescriptorSize<span class="token punctuation">,</span>
    <span class="token keyword">addr</span> memoryMapDescriptorVersion
  <span class="token punctuation">)</span>

  <span class="token comment"># IMPORTANT: After this point we cannot output anything to the console, since doing</span>
  <span class="token comment"># so may allocate memory and change the memory map, invalidating our map key. We can</span>
  <span class="token comment"># only output to the console in case of an error (since we quit anyway).</span>

  <span class="token keyword">if</span> status <span class="token operator">!=</span> EfiSuccess<span class="token operator">:</span>
    echo <span class="token operator">&amp;</span><span class="token string">&quot;boot: Failed to get memory map: {status:#x}&quot;</span>
    <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  status <span class="token operator">=</span> uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">exitBootServices</span><span class="token punctuation">(</span>imgHandle<span class="token punctuation">,</span> memoryMapKey<span class="token punctuation">)</span>
  <span class="token keyword">if</span> status <span class="token operator">!=</span> EfiSuccess<span class="token operator">:</span>
    echo <span class="token operator">&amp;</span><span class="token string">&quot;boot: Failed to exit boot services: {status:#x}&quot;</span>
    <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>

  <span class="token comment"># ======= NO MORE UEFI BOOT SERVICES =======</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This time the call to <code>exitBootServices</code> should succeed, but we won&#39;t see a <code>[success]</code> message in the console. We&#39;ll know that it succeeded if no error messages are printed.</p><p><img src="`+l+'" alt="Boot - Exit boot services"></p><p>Great! We&#39;re done with the UEFI Boot Services. Now we&#39;re ready to jump to the kernel image. We&#39;ll do this in the next section.</p>',37),r=[p];function d(v,u){return n(),a("div",null,r)}const h=s(c,[["render",d],["__file","09-loading-the-kernel-p2.html.vue"]]);export{h as default};
