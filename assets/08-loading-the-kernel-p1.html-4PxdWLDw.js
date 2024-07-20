import{_ as i,r as o,o as t,c as l,a as s,b as n,d as p,f as e}from"./app-y8sbR1MG.js";const c="/assets/boot-loadedimage-oDkEb5Gc.png",r="/assets/boot-simplefilesystem-l29YWrgh.png",d="/assets/boot-openkernelfile-QiADs_a8.png",u="/assets/boot-kernelfilesize-CzGVGsvw.png",v={},m=e(`<h1 id="loading-the-kernel-part-1" tabindex="-1"><a class="header-anchor" href="#loading-the-kernel-part-1" aria-hidden="true">#</a> Loading the Kernel (Part 1)</h1><p>In the last section we built a raw binary kernel image. We&#39;ll pick up where we left off in the bootloader and load the kernel image into memory. We&#39;ll rely on UEFI Boot Services to do so.</p><h2 id="uefi-boot-services" tabindex="-1"><a class="header-anchor" href="#uefi-boot-services" aria-hidden="true">#</a> UEFI Boot Services</h2><p>UEFI Boot Services provides a number of services to help us, including accessing the file system, getting information about a file, allocating memory, and reading a file into memory. Here&#39;s the plan:</p><ul><li>Use the bootloader image <code>EfiHandle</code> (which is passed to the entry point) to get its <code>EfiLoadedImageProtocol</code>.</li><li>Use the <code>EfiLoadedImageProtocol</code> device handle to get the <code>EfiSimpleFileSystemProtocol</code> of that device.</li><li>Use the <code>EfiSimpleFileSystemProtocol</code> to get the <code>EfiFileSystemInfo</code> represnting the root directory of the file system.</li><li>Use the <code>EfiSimpleFileSystemProtocol</code> and the kernel image path on the file system to get the <code>EfiFileProtocol</code> of the kernel file.</li><li>Use the <code>EfiFileProtocol</code> to get the <code>EfiFileInfo</code> of the kernel file, which contains the size of the file.</li><li>Use the Boot Services <code>AllocatePages</code> function to allocate enough pages, starting at address <code>0x100000</code> (1 MiB), to hold the kernel image.</li><li>Use <code>AllocatePages</code> to allocate a region for the kernel stack.</li><li>Use the <code>EfiFileProtocol</code> function to read the kernel image into memory.</li></ul><p>After reading the kernel into memory, and before jumping to it, we&#39;ll need to call the Boot Services <code>ExitBootServices</code> function to signal to the UEFI firmware that we&#39;re done with the Boot Services. To do so, we&#39;re required to also call the <code>GetMemoryMap</code> function to get the memory map, which contains a key that we&#39;ll pass to <code>ExitBootServices</code>. We&#39;ll also eventually pass this memory map to the kernel. So in addition to the plan above, we&#39;ll also:</p><ul><li>Use the Boot Services <code>GetMemoryMap</code> function to get the memory map.</li><li>Use the Boot Services <code>ExitBootServices</code> function, passing it the memory map key.</li><li>Jump to the kernel image starting address.</li></ul><p>This is a lot to take in, but it&#39;s how the UEFI spec was designed ¯\\<em>(ツ)</em>/¯. We&#39;ll take it one step at a time.</p><h2 id="boot-device-handle" tabindex="-1"><a class="header-anchor" href="#boot-device-handle" aria-hidden="true">#</a> Boot device handle</h2><p>Since we plan on storing the kernel image on the same device as the bootloader, we want to access the file system of the device from which the bootloader was loaded. The <code>EfiLoadedImageProtocol</code> (which we can get through the bootloader image handle) has a <code>DeviceHandle</code> field that we can use to get the <code>EfiSimpleFileSystemProtocol</code> of that device. So let&#39;s define the <code>EfiLoadedImageProtocol</code> in <code>src/common/uefi.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  <span class="token operator">...</span>
  EfiLoadedImageProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    revision<span class="token operator">*:</span> uint32
    parentHandle<span class="token operator">*:</span> EfiHandle
    systemTable<span class="token operator">*:</span> <span class="token keyword">ptr</span> EfiSystemTable
    <span class="token comment"># Source location of the image</span>
    deviceHandle<span class="token operator">*:</span> EfiHandle
    filePath<span class="token operator">*:</span> pointer
    reserved<span class="token operator">*:</span> pointer
    <span class="token comment"># Image&#39;s load options</span>
    loadOptionsSize<span class="token operator">*:</span> uint32
    loadOptions<span class="token operator">*:</span> pointer
    <span class="token comment"># Location where image was loaded</span>
    imageBase<span class="token operator">*:</span> pointer
    imageSize<span class="token operator">*:</span> uint64
    imageCodeType<span class="token operator">*:</span> EfiMemoryType
    imageDataType<span class="token operator">*:</span> EfiMemoryType
    unload<span class="token operator">*:</span> pointer
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The <code>EfiMemoryType</code> defines the various types of memory in the system. At some point we&#39;ll need to allocate memory for the kernel (code, data, and stack), so we&#39;ll need to differentiate these types of memory. The UEFI spec doesn&#39;t define kernel memory types, so we&#39;ll add a few more custom types to the enum, which fall in the range of OSV (Operating System Vendor) defined memory types (<code>0x80000000</code> to <code>0xFFFFFFFF</code>).</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code>  EfiMemoryType<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">enum</span>
    EfiReservedMemory
    EfiLoaderCode
    EfiLoaderData
    EfiBootServicesCode
    EfiBootServicesData
    EfiRuntimeServicesCode
    EfiRuntimeServicesData
    EfiConventionalMemory
    EfiUnusableMemory
    EfiACPIReclaimMemory
    EfiACPIMemoryNVS
    EfiMemoryMappedIO
    EfiMemoryMappedIOPortSpace
    EfiPalCode
    EfiPersistentMemory
    EfiUnacceptedMemory
    OsvKernelCode <span class="token operator">=</span> <span class="token number">0x80000000</span>
    OsvKernelData <span class="token operator">=</span> <span class="token number">0x80000001</span>
    OsvKernelStack <span class="token operator">=</span> <span class="token number">0x80000002</span>
    EfiMaxMemoryType
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>To get the <code>EfiLoadedImageProtocol</code> from the bootloader image handle, we&#39;ll use the <code>handleProtocol</code> function of the Boot Services. So let&#39;s define the <code>BootServices</code> type and the <code>handleProtocol</code> function in <code>src/common/uefi.nim</code>. It&#39;s a large type with many functions, so I won&#39;t define the type of every field; we&#39;ll use <code>pointer</code> for those fields until we need to use them.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiBootServices<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    hdr<span class="token operator">*:</span> EfiTableHeader
    <span class="token comment"># task priority services</span>
    raiseTpl<span class="token operator">*:</span> pointer
    restoreTpl<span class="token operator">*:</span> pointer
    <span class="token comment"># memory services</span>
    allocatePages<span class="token operator">*:</span> pointer
    freePages<span class="token operator">*:</span> pointer
    getMemoryMap<span class="token operator">*:</span> pointer
    allocatePool<span class="token operator">*:</span> pointer
    freePool<span class="token operator">*:</span> pointer
    <span class="token comment"># event &amp; timer services</span>
    createEvent<span class="token operator">*:</span> pointer
    setTimer<span class="token operator">*:</span> pointer
    waitForEvent<span class="token operator">*:</span> pointer
    signalEvent<span class="token operator">*:</span> pointer
    closeEvent<span class="token operator">*:</span> pointer
    checkEvent<span class="token operator">*:</span> pointer
    <span class="token comment"># protocol handler services</span>
    installProtocolInterface<span class="token operator">*:</span> pointer
    reinstallProtocolInterface<span class="token operator">*:</span> pointer
    uninstallProtocolInterface<span class="token operator">*:</span> pointer
    handleProtocol<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>handle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> protocol<span class="token operator">:</span> EfiGuid<span class="token punctuation">,</span> <span class="token identifier"><span class="token punctuation">\`</span>interface<span class="token punctuation">\`</span></span><span class="token operator">:</span> <span class="token keyword">ptr</span> pointer<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
    reserved<span class="token operator">*:</span> pointer
    registerProtocolNotify<span class="token operator">*:</span> pointer
    locateHandle<span class="token operator">*:</span> pointer
    locateDevicePath<span class="token operator">*:</span> pointer
    installConfigurationTable<span class="token operator">*:</span> pointer
    <span class="token comment"># image services</span>
    loadImage<span class="token operator">*:</span> pointer
    startImage<span class="token operator">*:</span> pointer
    exit<span class="token operator">*:</span> pointer
    unloadImage<span class="token operator">*:</span> pointer
    exitBootServices<span class="token operator">*:</span> pointer
    <span class="token comment"># misc services</span>
    getNextMonotonicCount<span class="token operator">*:</span> pointer
    stall<span class="token operator">*:</span> pointer
    setWatchdogTimer<span class="token operator">*:</span> pointer
    <span class="token comment"># driver support services</span>
    connectController<span class="token operator">*:</span> pointer
    disconnectController<span class="token operator">*:</span> pointer
    <span class="token comment"># open and close protocol services</span>
    openProtocol<span class="token operator">*:</span> pointer
    closeProtocol<span class="token operator">*:</span> pointer
    openProtocolInformation<span class="token operator">*:</span> pointer
    <span class="token comment"># library services</span>
    protocolsPerHandle<span class="token operator">*:</span> pointer
    locateHandleBuffer<span class="token operator">*:</span> pointer
    locateProtocol<span class="token operator">*:</span> pointer
    installMultipleProtocolInterfaces<span class="token operator">*:</span> pointer
    uninstallMultipleProtocolInterfaces<span class="token operator">*:</span> pointer
    <span class="token comment"># 32-bit CRC services</span>
    calculateCrc32<span class="token operator">*:</span> pointer
    <span class="token comment"># misc services</span>
    copyMem<span class="token operator">*:</span> pointer
    setMem<span class="token operator">*:</span> pointer
    createEventEx<span class="token operator">*:</span> pointer
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>One of the parameters of the <code>handleProtocol</code> function is of type <code>EfiGuid</code>. Let&#39;s define it as well.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token keyword">type</span>
  EfiGuid<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    data1<span class="token operator">:</span> uint32
    data2<span class="token operator">:</span> uint16
    data3<span class="token operator">:</span> uint16
    data4<span class="token operator">:</span> array<span class="token punctuation">[</span><span class="token number">8</span><span class="token punctuation">,</span> uint8<span class="token punctuation">]</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We&#39;re interested in the <code>EfiLoadedImageProtocol</code>, so we need to define its GUID.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token keyword">const</span>
  EfiLoadedImageProtocolGuid<span class="token operator">*</span> <span class="token operator">=</span> <span class="token function">EfiGuid</span><span class="token punctuation">(</span>
    data1<span class="token operator">:</span> <span class="token number">0x5B1B31A1</span><span class="token punctuation">,</span> data2<span class="token operator">:</span> <span class="token number">0x9562</span><span class="token punctuation">,</span> data3<span class="token operator">:</span> <span class="token number">0x11d2</span><span class="token punctuation">,</span>
    data4<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token number">0x8e</span><span class="token punctuation">,</span> <span class="token number">0x3f</span><span class="token punctuation">,</span> <span class="token number">0x00</span><span class="token punctuation">,</span> <span class="token number">0xa0</span><span class="token punctuation">,</span> <span class="token number">0xc9</span><span class="token punctuation">,</span> <span class="token number">0x69</span><span class="token punctuation">,</span> <span class="token number">0x72</span><span class="token punctuation">,</span> <span class="token number">0x3b</span><span class="token punctuation">]</span>
  <span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we&#39;re ready to call the <code>handleProtocol</code> function to get the <code>EfiLoadedImageProtocol</code> from the bootloader image handle.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">import</span> common<span class="token operator">/</span>uefi
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">checkStatus<span class="token operator">*</span></span><span class="token punctuation">(</span>status<span class="token operator">:</span> EfiStatus<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token keyword">if</span> status <span class="token operator">!=</span> EfiSuccess<span class="token operator">:</span>
    consoleOut <span class="token operator">&amp;</span><span class="token string">&quot; [failed, status = {status:#x}]&quot;</span>
    <span class="token function">quit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  consoleOut <span class="token string">&quot; [success]\\r\\n&quot;</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  echo <span class="token string">&quot;Fusion OS Bootloader&quot;</span>

  <span class="token keyword">var</span> status<span class="token operator">:</span> EfiStatus

  <span class="token comment"># get the LoadedImage protocol from the image handle</span>
  <span class="token keyword">var</span> loadedImage<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiLoadedImageProtocol

  consoleOut <span class="token string">&quot;boot: Acquiring LoadedImage protocol&quot;</span>
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">handleProtocol</span><span class="token punctuation">(</span>
    imgHandle<span class="token punctuation">,</span> EfiLoadedImageProtocolGuid<span class="token punctuation">,</span> <span class="token function">cast[ptr pointer]</span><span class="token punctuation">(</span><span class="token keyword">addr</span> loadedImage<span class="token punctuation">)</span>
  <span class="token punctuation">)</span>
<span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s compile and run everything using <code>just run</code>. We should see the following output (The colored output is for nice visuals only. I didn&#39;t show it in the code above; I&#39;m leaving it as an exercise for the reader):</p><p><img src="`+c+`" alt="Boot - LoadedImage"></p><h2 id="file-system" tabindex="-1"><a class="header-anchor" href="#file-system" aria-hidden="true">#</a> File system</h2><p>Now that we have the <code>EfiLoadedImageProtocol</code> device handle, we can get the <code>EfiSimpleFileSystemProtocol</code> of that device. Let&#39;s define the <code>EfiSimpleFileSystemProtocol</code> type and the corresponding GUID in <code>src/common/uefi.nim</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiSimpleFileSystemProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    revision<span class="token operator">*:</span> uint64
    openVolume<span class="token operator">*:</span> pointer

<span class="token keyword">const</span>
  EfiSimpleFileSystemProtocolGuid<span class="token operator">*</span> <span class="token operator">=</span> <span class="token function">EfiGuid</span><span class="token punctuation">(</span>
    data1<span class="token operator">:</span> <span class="token number">0x964e5b22&#39;u32</span><span class="token punctuation">,</span> data2<span class="token operator">:</span> <span class="token number">0x6459</span><span class="token punctuation">,</span> data3<span class="token operator">:</span> <span class="token number">0x11d2</span><span class="token punctuation">,</span>
    data4<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token number">0x8e</span><span class="token punctuation">,</span> <span class="token number">0x39</span><span class="token punctuation">,</span> <span class="token number">0x00</span><span class="token punctuation">,</span> <span class="token number">0xa0</span><span class="token punctuation">,</span> <span class="token number">0xc9</span><span class="token punctuation">,</span> <span class="token number">0x69</span><span class="token punctuation">,</span> <span class="token number">0x72</span><span class="token punctuation">,</span> <span class="token number">0x3b</span><span class="token punctuation">]</span>
  <span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we&#39;re ready to get the <code>EfiSimpleFileSystemProtocol</code> from the <code>EfiLoadedImageProtocol</code> device handle.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># get the FileSystem protocol from the device handle</span>
  <span class="token keyword">var</span> fileSystem<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiSimpleFileSystemProtocol

  consoleOut <span class="token string">&quot;boot: Acquiring SimpleFileSystem protocol&quot;</span>
  checkStatus uefi<span class="token operator">.</span>sysTable<span class="token operator">.</span>bootServices<span class="token operator">.</span><span class="token function">handleProtocol</span><span class="token punctuation">(</span>
    loadedImage<span class="token operator">.</span>deviceHandle<span class="token punctuation">,</span> EfiSimpleFileSystemProtocolGuid<span class="token punctuation">,</span> <span class="token function">cast[ptr pointer]</span><span class="token punctuation">(</span><span class="token keyword">addr</span> fileSystem<span class="token punctuation">)</span>
  <span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If we compile and run we should see the following output:</p><p><img src="`+r+`" alt="Alt text"></p><h2 id="root-directory" tabindex="-1"><a class="header-anchor" href="#root-directory" aria-hidden="true">#</a> Root directory</h2><p>Next, we need to get the <code>EfiFileInfo</code> representing the root directory of the file system. Let&#39;s define the <code>EfiFileInfo</code> type (we also need to define the <code>EfiTime</code> type, which is used in <code>EfiFileInfo</code>) .</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiFileInfo<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    size<span class="token operator">*:</span> uint64
    fileSize<span class="token operator">*:</span> uint64
    physicalSize<span class="token operator">*:</span> uint64
    createTime<span class="token operator">*:</span> EfiTime
    lastAccessTime<span class="token operator">*:</span> EfiTime
    modificationTime<span class="token operator">*:</span> EfiTime
    attribute<span class="token operator">*:</span> uint64
    fileName<span class="token operator">*:</span> array<span class="token punctuation">[</span><span class="token number">256</span><span class="token punctuation">,</span> Utf16Char<span class="token punctuation">]</span>

  EfiTime<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    year<span class="token operator">*:</span> uint16
    month<span class="token operator">*:</span> uint8
    day<span class="token operator">*:</span> uint8
    hour<span class="token operator">*:</span> uint8
    minute<span class="token operator">*:</span> uint8
    second<span class="token operator">*:</span> uint8
    pad1<span class="token operator">*:</span> uint8
    nanosecond<span class="token operator">*:</span> uint32
    timeZone<span class="token operator">*:</span> int16
    daylight<span class="token operator">*:</span> uint8
    pad2<span class="token operator">*:</span> uint8
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,33),k=s("code",null,"fileName",-1),h={href:"https://en.wikipedia.org/wiki/Flexible_array_member",target:"_blank",rel:"noopener noreferrer"},b=e(`<p>Let&#39;s use the <code>openVolume</code> function of the <code>EfiSimpleFileSystemProtocol</code> to get the <code>EfiFileInfo</code> of the root directory. First, we need to update the signature of <code>openVolume</code>, which also requires defining the <code>EfiFileProtocol</code> type.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiSimpleFileSystemProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    revision<span class="token operator">*:</span> uint64
    openVolume<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>this<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiSimpleFileSystemProtocol<span class="token punctuation">,</span> root<span class="token operator">:</span> <span class="token keyword">ptr</span> <span class="token keyword">ptr</span> EfiFileProtocol<span class="token punctuation">)</span><span class="token operator">:</span>
      EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>

  EfiFileProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    revision<span class="token operator">*:</span> uint64
    open<span class="token operator">*:</span> pointer
    close<span class="token operator">*:</span> pointer
    delete<span class="token operator">*:</span> pointer
    read<span class="token operator">*:</span> pointer
    write<span class="token operator">*:</span> pointer
    getPosition<span class="token operator">*:</span> pointer
    setPosition<span class="token operator">*:</span> pointer
    getInfo<span class="token operator">*:</span> pointer
    setInfo<span class="token operator">*:</span> pointer
    flush<span class="token operator">*:</span> pointer
    openEx<span class="token operator">*:</span> pointer
    readEx<span class="token operator">*:</span> pointer
    writeEx<span class="token operator">*:</span> pointer
    flushEx<span class="token operator">*:</span> pointer
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we&#39;re ready to get the <code>EfiFileInfo</code> of the root directory.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># open the root directory</span>
  <span class="token keyword">var</span> rootDir<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol

  consoleOut <span class="token string">&quot;boot: Opening root directory&quot;</span>
  checkStatus fileSystem<span class="token operator">.</span><span class="token function">openVolume</span><span class="token punctuation">(</span>fileSystem<span class="token punctuation">,</span> <span class="token keyword">addr</span> rootDir<span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This should also compile and run successfully.</p><h2 id="kernel-image-file" tabindex="-1"><a class="header-anchor" href="#kernel-image-file" aria-hidden="true">#</a> Kernel image file</h2><p>We have the <code>EfiFileProtocol</code> of the root directory, so we can use it to get the <code>EfiFileProtocol</code> of the kernel image file, given its path. To open the kernel file, we&#39;ll need to define the <code>open</code> function of the <code>EfiFileProtocol</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiFileProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    revision<span class="token operator">*:</span> uint64
    open<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>
        this<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol<span class="token punctuation">,</span>
        newHandle<span class="token operator">:</span> <span class="token keyword">ptr</span> <span class="token keyword">ptr</span> EfiFileProtocol<span class="token punctuation">,</span>
        fileName<span class="token operator">:</span> WideCString<span class="token punctuation">,</span>
        openMode<span class="token operator">:</span> uint64<span class="token punctuation">,</span>
        attributes<span class="token operator">:</span> uint64
      <span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
  <span class="token operator">...</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now we&#39;re ready to open the kernel file.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># open the kernel file</span>
  <span class="token keyword">var</span> kernelFile<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol
  <span class="token keyword">let</span> kernelPath <span class="token operator">=</span> <span class="token string">W&quot;efi\\fusion\\kernel.bin&quot;</span>

  consoleOut <span class="token string">&quot;boot: Opening kernel file: &quot;</span>
  consoleOut kernelPath
  checkStatus rootDir<span class="token operator">.</span><span class="token function">open</span><span class="token punctuation">(</span>rootDir<span class="token punctuation">,</span> <span class="token keyword">addr</span> kernelFile<span class="token punctuation">,</span> kernelPath<span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This should also compile and run successfully.</p><p><img src="`+d+`" alt="Boot - Open kernel file"></p><p>Let&#39;s now get the size of the kernel file. To do so, we&#39;ll need to define the <code>getInfo</code> function of the <code>EfiFileProtocol</code>. We&#39;ll also need to define <code>EfiFileInfoGuid</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/common/uefi.nim</span>

<span class="token keyword">type</span>
  EfiFileProtocol<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    <span class="token operator">...</span>
    getInfo<span class="token operator">*:</span> <span class="token function">proc</span> <span class="token punctuation">(</span>
        this<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiFileProtocol<span class="token punctuation">,</span>
        infoType<span class="token operator">:</span> <span class="token keyword">ptr</span> EfiGuid<span class="token punctuation">,</span>
        infoSize<span class="token operator">:</span> <span class="token keyword">ptr</span> uint<span class="token punctuation">,</span>
        info<span class="token operator">:</span> pointer
      <span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token punctuation">{.</span>cdecl<span class="token punctuation">.}</span>
  <span class="token operator">...</span>

<span class="token keyword">const</span>
  EfiFileInfoGuid<span class="token operator">*</span> <span class="token operator">=</span> <span class="token function">EfiGuid</span><span class="token punctuation">(</span>
    data1<span class="token operator">:</span> <span class="token number">0x09576e92&#39;u32</span><span class="token punctuation">,</span> data2<span class="token operator">:</span> <span class="token number">0x6d3f</span><span class="token punctuation">,</span> data3<span class="token operator">:</span> <span class="token number">0x11d2</span><span class="token punctuation">,</span>
    data4<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token number">0x8e</span><span class="token punctuation">,</span> <span class="token number">0x39</span><span class="token punctuation">,</span> <span class="token number">0x00</span><span class="token punctuation">,</span> <span class="token number">0xa0</span><span class="token punctuation">,</span> <span class="token number">0xc9</span><span class="token punctuation">,</span> <span class="token number">0x69</span><span class="token punctuation">,</span> <span class="token number">0x72</span><span class="token punctuation">,</span> <span class="token number">0x3b</span><span class="token punctuation">]</span>
  <span class="token punctuation">)</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s call the <code>getInfo</code> function on the kernel file.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/boot/bootx64.nim</span>

<span class="token keyword">proc</span> <span class="token function">EfiMainInner</span><span class="token punctuation">(</span>imgHandle<span class="token operator">:</span> EfiHandle<span class="token punctuation">,</span> sysTable<span class="token operator">:</span> <span class="token keyword">ptr</span> EFiSystemTable<span class="token punctuation">)</span><span class="token operator">:</span> EfiStatus <span class="token operator">=</span>
  <span class="token operator">...</span>

  <span class="token comment"># get kernel file size</span>
  <span class="token keyword">var</span> kernelInfo<span class="token operator">:</span> EfiFileInfo
  <span class="token keyword">var</span> kernelInfoSize <span class="token operator">=</span> <span class="token function">sizeof</span><span class="token punctuation">(</span>EfiFileInfo<span class="token punctuation">)</span><span class="token operator">.</span>uint

  consoleOut <span class="token string">&quot;boot: Getting kernel file info&quot;</span>
  checkStatus kernelFile<span class="token operator">.</span><span class="token function">getInfo</span><span class="token punctuation">(</span>kernelFile<span class="token punctuation">,</span> <span class="token keyword">addr</span> EfiFileInfoGuid<span class="token punctuation">,</span> <span class="token keyword">addr</span> kernelInfoSize<span class="token punctuation">,</span> <span class="token keyword">addr</span> kernelInfo<span class="token punctuation">)</span>
  echo <span class="token operator">&amp;</span><span class="token string">&quot;boot: Kernel file size: {kernelInfo.fileSize} bytes&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div><div class="highlight-line"> </div></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>If all goes well, we should see the kernel file size in the output:</p><p><img src="`+u+'" alt="Boot - Kernel file size"></p><p>Great! The kernel image size is what we expect (around 1.1 MiB). In the next section we&#39;ll continue to allocate memory for the kernel image and read it into memory.</p>',19);function g(f,y){const a=o("ExternalLinkIcon");return t(),l("div",null,[m,s("p",null,[n("The "),k,n(" field in the UEFI spec is a C "),s("a",h,[n("flexible array member"),p(a)]),n(", which is not supported in Nim. So I'm using a fixed size array here.")]),b])}const w=i(v,[["render",g],["__file","08-loading-the-kernel-p1.html.vue"]]);export{w as default};
