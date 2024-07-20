import{_ as s,o as n,c as a,f as e}from"./app-y8sbR1MG.js";const t={},o=e(`<h1 id="tasks" tabindex="-1"><a class="header-anchor" href="#tasks" aria-hidden="true">#</a> Tasks</h1><p>We&#39;re starting to accumulate a number of things about the user program that the kernel needs to track: the user page table, the user stack, the kernel switch stack, and the user <code>rsp</code> when executing <code>syscall</code>. These are all currently tracked in global variables. Once we start having more than one user task, it will be hard to keep track of all these things.</p><h2 id="task-definition" tabindex="-1"><a class="header-anchor" href="#task-definition" aria-hidden="true">#</a> Task definition</h2><p>Let&#39;s define a <code>Task</code> type to encapsulate all this information. This will prepare us for having multiple tasks. Let&#39;s create a new module <code>tasks.nim</code> for this.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/tasks.nim</span>

<span class="token keyword">import</span> common<span class="token operator">/</span>pagetables
<span class="token keyword">import</span> vmm

<span class="token keyword">type</span>
  TaskStack<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    data<span class="token operator">*:</span> <span class="token keyword">ptr</span> uint8
    size<span class="token operator">*:</span> uint64
    bottom<span class="token operator">*:</span> uint64

  Task<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">ref</span> <span class="token keyword">object</span>
    id<span class="token operator">*:</span> uint64
    pml4<span class="token operator">*:</span> <span class="token keyword">ptr</span> PML4Table
    ustack<span class="token operator">*:</span> TaskStack
    kstack<span class="token operator">*:</span> TaskStack
    rsp<span class="token operator">*:</span> uint64

<span class="token keyword">var</span>
  nextId<span class="token operator">*:</span> uint64 <span class="token operator">=</span> <span class="token number">0</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Each task has a unique <code>id</code>, a pointer to its page table, and two stacks: one for user mode and one for kernel mode. The <code>rsp</code> field is where the user stack pointer is stored when the task is executing in kernel mode (e.g. when executing a system call). We also define a <code>TaskStack</code> type to encapsulate the stack address, size, and the bottom of the stack (i.e. the address just beyond the end of the stack). The <code>nextId</code> variable will be used to assign unique IDs to each task.</p><p>Before we can start creating tasks, we need a way to allocate virtual memory within an address space. Let&#39;s add a few things to the virtual memory manager to support this.</p><h2 id="address-space-abstraction" tabindex="-1"><a class="header-anchor" href="#address-space-abstraction" aria-hidden="true">#</a> Address space abstraction</h2><p>For a particular address space, we need to track which regions are currently allocated, and a way to allocate more regions. We&#39;ll use this to allocate the user stack and kernel stack. To make it easy to refer to a particular address space, and track which regions are currently allocated in it, we&#39;ll define a <code>VMAddressSpace</code> type.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/vmm.nim</span>

<span class="token keyword">type</span>
  VMRegion<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    start<span class="token operator">:</span> VirtAddr
    npages<span class="token operator">:</span> uint64

  VMAddressSpace<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">object</span>
    minAddress<span class="token operator">*:</span> VirtAddr
    maxAddress<span class="token operator">*:</span> VirtAddr
    regions<span class="token operator">*:</span> seq<span class="token punctuation">[</span>VMRegion<span class="token punctuation">]</span>
    pml4<span class="token operator">*:</span> <span class="token keyword">ptr</span> PML4Table
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notice that I also defined a <code>VMRegion</code> type to represent a contiguous region of virtual memory. Notice also that I defined two fields <code>minAddress</code> and <code>maxAddress</code> in <code>VMAddressSpace</code> to track the minimum and maximum addresses in the address space. This will make it easy to confine the address space to the lower half (for user space) or upper half (for kernel space) of the virtual address space.</p><p>Let&#39;s make a slight modification to the <code>Task</code> type to use the new <code>VMAddressSpace</code> type instead of a pointer to a <code>PML4Table</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code>  Task<span class="token operator">*</span> <span class="token operator">=</span> <span class="token keyword">ref</span> <span class="token keyword">object</span>
    id<span class="token operator">*:</span> uint64
    space<span class="token operator">*:</span> VMAddressSpace
    ustack<span class="token operator">*:</span> TaskStack
    kstack<span class="token operator">*:</span> TaskStack
    rsp<span class="token operator">*:</span> uint64
</code></pre><div class="highlight-lines"><br><br><div class="highlight-line"> </div><br><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s now add a proc to allocate virtual memory in an address space.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/vmm.nim</span>
<span class="token keyword">import</span> std<span class="token operator">/</span>algorithm
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">vmalloc<span class="token operator">*</span></span><span class="token punctuation">(</span>
  space<span class="token operator">:</span> <span class="token keyword">var</span> VMAddressSpace<span class="token punctuation">,</span>
  pageCount<span class="token operator">:</span> uint64<span class="token punctuation">,</span>
  pageAccess<span class="token operator">:</span> PageAccess<span class="token punctuation">,</span>
  pageMode<span class="token operator">:</span> PageMode<span class="token punctuation">,</span>
<span class="token punctuation">)</span><span class="token operator">:</span> Option<span class="token punctuation">[</span>VirtAddr<span class="token punctuation">]</span> <span class="token operator">=</span>
  <span class="token comment"># find a free region</span>
  <span class="token keyword">var</span> virtAddr<span class="token operator">:</span> VirtAddr <span class="token operator">=</span> space<span class="token operator">.</span>minAddress
  <span class="token keyword">for</span> region <span class="token operator">in</span> space<span class="token operator">.</span>regions<span class="token operator">:</span>
    <span class="token keyword">if</span> virtAddr <span class="token operator">+!</span> pageCount <span class="token operator">*</span> PageSize <span class="token operator">&lt;=</span> region<span class="token operator">.</span>start<span class="token operator">:</span>
      <span class="token keyword">break</span>
    virtAddr <span class="token operator">=</span> region<span class="token operator">.</span>start <span class="token operator">+!</span> region<span class="token operator">.</span>npages <span class="token operator">*</span> PageSize

  <span class="token comment"># allocate physical memory and map it</span>
  <span class="token keyword">let</span>  physAddr <span class="token operator">=</span> <span class="token function">pmalloc</span><span class="token punctuation">(</span>pageCount<span class="token punctuation">)</span><span class="token operator">.</span>get <span class="token comment"># TODO: handle allocation failure</span>
  <span class="token function">mapRegion</span><span class="token punctuation">(</span>space<span class="token operator">.</span>pml4<span class="token punctuation">,</span> virtAddr<span class="token punctuation">,</span> physAddr<span class="token punctuation">,</span> pageCount<span class="token punctuation">,</span> pageAccess<span class="token punctuation">,</span> pageMode<span class="token punctuation">)</span>

  <span class="token comment"># add the region to the address space</span>
  space<span class="token operator">.</span>regions<span class="token operator">.</span>add <span class="token function">VMRegion</span><span class="token punctuation">(</span>start<span class="token operator">:</span> virtAddr<span class="token punctuation">,</span> npages<span class="token operator">:</span> pageCount<span class="token punctuation">)</span>

  <span class="token comment"># sort the regions by start address</span>
  space<span class="token operator">.</span>regions <span class="token operator">=</span> space<span class="token operator">.</span>regions<span class="token operator">.</span><span class="token function">sortedByIt</span><span class="token punctuation">(</span>it<span class="token operator">.</span>start<span class="token punctuation">)</span>

  result <span class="token operator">=</span> some virtAddr
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The <code>vmalloc</code> proc finds a free region in the address space, allocates physical memory, and maps it into the address space. It returns the virtual address of the allocated region. We then sort the regions by start address, so that we can easily find a free region in the future. (Ideally, the standard library should provide a sorted container that we can use here, but for now, we&#39;ll just sort the regions manually after adding a new one.)</p><p>We also need a way to add existing VM regions to an address space. We&#39;ll need this to add the existing kernel VM regions (code/data and stack) to its address space.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/vmm.nim</span>

<span class="token keyword">proc</span> <span class="token function">vmAddRegion<span class="token operator">*</span></span><span class="token punctuation">(</span>space<span class="token operator">:</span> <span class="token keyword">var</span> VMAddressSpace<span class="token punctuation">,</span> start<span class="token operator">:</span> VirtAddr<span class="token punctuation">,</span> npages<span class="token operator">:</span> uint64<span class="token punctuation">)</span> <span class="token operator">=</span>
  space<span class="token operator">.</span>regions<span class="token operator">.</span>add <span class="token function">VMRegion</span><span class="token punctuation">(</span>start<span class="token operator">:</span> start<span class="token punctuation">,</span> npages<span class="token operator">:</span> npages<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="kernel-address-space" tabindex="-1"><a class="header-anchor" href="#kernel-address-space" aria-hidden="true">#</a> Kernel address space</h2><p>The kernel itself needs its own address space. Let&#39;s create a global variable <code>kspace</code> to track it.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/vmm.nim</span>
<span class="token operator">...</span>

<span class="token keyword">const</span>
  KernelSpaceMinAddress<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0xffff800000000000&#39;u64</span><span class="token operator">.</span>VirtAddr
  KernelSpaceMaxAddress<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0xffffffffffffffff&#39;u64</span><span class="token operator">.</span>VirtAddr
  UserSpaceMinAddress<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0x0000000000000000&#39;u64</span><span class="token operator">.</span>VirtAddr
  UserSpaceMaxAddress<span class="token operator">*</span> <span class="token operator">=</span> <span class="token number">0x00007fffffffffff&#39;u64</span><span class="token operator">.</span>VirtAddr

<span class="token keyword">var</span>
  kspace<span class="token operator">*:</span> VMAddressSpace

<span class="token keyword">proc</span> <span class="token function">vmInit<span class="token operator">*</span></span><span class="token punctuation">(</span>physMemoryVirtualBase<span class="token operator">:</span> uint64<span class="token punctuation">,</span> physAlloc<span class="token operator">:</span> PhysAlloc<span class="token punctuation">)</span> <span class="token operator">=</span>
  physicalMemoryVirtualBase <span class="token operator">=</span> physMemoryVirtualBase
  pmalloc <span class="token operator">=</span> physAlloc
  kspace <span class="token operator">=</span> <span class="token function">VMAddressSpace</span><span class="token punctuation">(</span>
    minAddress<span class="token operator">:</span> KernelSpaceMinAddress<span class="token punctuation">,</span>
    maxAddress<span class="token operator">:</span> KernelSpaceMaxAddress<span class="token punctuation">,</span>
    regions<span class="token operator">:</span> <span class="token operator">@</span><span class="token punctuation">[</span><span class="token punctuation">]</span><span class="token punctuation">,</span>
    pml4<span class="token operator">:</span> <span class="token function">getActivePML4</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
  <span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s also add the existing kernel VM regions to it (code/data and stack).</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">KernelMain</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token operator">...</span>

  debug <span class="token string">&quot;kernel: Initializing virtual memory manager &quot;</span>
  <span class="token function">vmInit</span><span class="token punctuation">(</span>bootInfo<span class="token operator">.</span>physicalMemoryVirtualBase<span class="token punctuation">,</span> pmm<span class="token operator">.</span>pmAlloc<span class="token punctuation">)</span>
  <span class="token function">vmAddRegion</span><span class="token punctuation">(</span>kspace<span class="token punctuation">,</span> bootInfo<span class="token operator">.</span>kernelImageVirtualBase<span class="token operator">.</span>VirtAddr<span class="token punctuation">,</span> bootInfo<span class="token operator">.</span>kernelImagePages<span class="token punctuation">)</span>
  <span class="token function">vmAddRegion</span><span class="token punctuation">(</span>kspace<span class="token punctuation">,</span> bootInfo<span class="token operator">.</span>kernelStackVirtualBase<span class="token operator">.</span>VirtAddr<span class="token punctuation">,</span> bootInfo<span class="token operator">.</span>kernelStackPages<span class="token punctuation">)</span>
  debugln <span class="token string">&quot;[success]&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="creating-a-task" tabindex="-1"><a class="header-anchor" href="#creating-a-task" aria-hidden="true">#</a> Creating a task</h2><p>Creating a task involves the following steps:</p><ol><li>Creating a VM address space and allocating a page table</li><li>Mapping the task image (code and data) into the task page table</li><li>Mapping the kernel space into the task page table</li><li>Allocating and mapping a user stack (in user space)</li><li>Allocating and mapping a kernel stack (in kernel space)</li><li>Creating an interrupt stack frame on the kernel stack (for switching to user mode)</li><li>Setting the <code>rsp</code> field to the interrupt stack frame</li></ol><p>This seems like a lot of steps, but it&#39;s not too bad. Let&#39;s add a <code>createTask</code> proc to the <code>tasks</code> module to do all this. We&#39;ll also add a <code>createStack</code> helper proc to allocate a stack in a particular address space.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/tasks.nim</span>

<span class="token keyword">proc</span> <span class="token function">createStack<span class="token operator">*</span></span><span class="token punctuation">(</span>space<span class="token operator">:</span> <span class="token keyword">var</span> VMAddressSpace<span class="token punctuation">,</span> npages<span class="token operator">:</span> uint64<span class="token punctuation">,</span> mode<span class="token operator">:</span> PageMode<span class="token punctuation">)</span><span class="token operator">:</span> TaskStack <span class="token operator">=</span>
  <span class="token keyword">let</span> stackPtr <span class="token operator">=</span> <span class="token function">vmalloc</span><span class="token punctuation">(</span>space<span class="token punctuation">,</span> npages<span class="token punctuation">,</span> paReadWrite<span class="token punctuation">,</span> mode<span class="token punctuation">)</span>
  <span class="token keyword">if</span> stackPtr<span class="token operator">.</span>isNone<span class="token operator">:</span>
    <span class="token keyword">raise</span> <span class="token function">newException</span><span class="token punctuation">(</span>Exception<span class="token punctuation">,</span> <span class="token string">&quot;tasks: Failed to allocate stack&quot;</span><span class="token punctuation">)</span>
  result<span class="token operator">.</span>data <span class="token operator">=</span> <span class="token keyword">cast</span><span class="token punctuation">[</span><span class="token keyword">ptr</span> UncheckedArray<span class="token punctuation">[</span>uint64<span class="token punctuation">]</span><span class="token punctuation">]</span><span class="token punctuation">(</span>stackPtr<span class="token operator">.</span>get<span class="token punctuation">)</span>
  result<span class="token operator">.</span>size <span class="token operator">=</span> npages <span class="token operator">*</span> PageSize
  result<span class="token operator">.</span>bottom <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>result<span class="token operator">.</span>data<span class="token punctuation">)</span> <span class="token operator">+</span> result<span class="token operator">.</span>size

<span class="token keyword">proc</span> <span class="token function">createTask<span class="token operator">*</span></span><span class="token punctuation">(</span>
  imageVirtAddr<span class="token operator">:</span> VirtAddr<span class="token punctuation">,</span>
  imagePhysAddr<span class="token operator">:</span> PhysAddr<span class="token punctuation">,</span>
  imagePageCount<span class="token operator">:</span> uint64<span class="token punctuation">,</span>
  entryPoint<span class="token operator">:</span> VirtAddr
<span class="token punctuation">)</span><span class="token operator">:</span> Task <span class="token operator">=</span>
  <span class="token function">new</span><span class="token punctuation">(</span>result<span class="token punctuation">)</span>

  <span class="token keyword">let</span> taskId <span class="token operator">=</span> nextId
  inc nextId

  <span class="token keyword">var</span> uspace <span class="token operator">=</span> <span class="token function">VMAddressSpace</span><span class="token punctuation">(</span>
    minAddress<span class="token operator">:</span> UserSpaceMinAddress<span class="token punctuation">,</span>
    maxAddress<span class="token operator">:</span> UserSpaceMaxAddress<span class="token punctuation">,</span>
    pml4<span class="token operator">:</span> <span class="token function">cast[ptr PML4Table]</span><span class="token punctuation">(</span>new PML4Table<span class="token punctuation">)</span>
  <span class="token punctuation">)</span>

  <span class="token comment"># map task image</span>
  <span class="token function">mapRegion</span><span class="token punctuation">(</span>
    pml4 <span class="token operator">=</span> uspace<span class="token operator">.</span>pml4<span class="token punctuation">,</span>
    virtAddr <span class="token operator">=</span> imageVirtAddr<span class="token punctuation">,</span>
    physAddr <span class="token operator">=</span> imagePhysAddr<span class="token punctuation">,</span>
    pageCount <span class="token operator">=</span> imagePageCount<span class="token punctuation">,</span>
    pageAccess <span class="token operator">=</span> paReadWrite<span class="token punctuation">,</span>
    pageMode <span class="token operator">=</span> pmUser<span class="token punctuation">,</span>
  <span class="token punctuation">)</span>

  <span class="token comment"># map kernel space</span>
  <span class="token keyword">var</span> kpml4 <span class="token operator">=</span> <span class="token function">getActivePML4</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  <span class="token keyword">for</span> i <span class="token operator">in</span> <span class="token number">256</span> <span class="token operator">..&lt;</span> <span class="token number">512</span><span class="token operator">:</span>
    uspace<span class="token operator">.</span>pml4<span class="token operator">.</span>entries<span class="token punctuation">[</span>i<span class="token punctuation">]</span> <span class="token operator">=</span> kpml4<span class="token operator">.</span>entries<span class="token punctuation">[</span>i<span class="token punctuation">]</span>

  <span class="token comment"># create user and kernel stacks</span>
  <span class="token keyword">let</span> ustack <span class="token operator">=</span> <span class="token function">createStack</span><span class="token punctuation">(</span>uspace<span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">,</span> pmUser<span class="token punctuation">)</span>
  <span class="token keyword">let</span> kstack <span class="token operator">=</span> <span class="token function">createStack</span><span class="token punctuation">(</span>kspace<span class="token punctuation">,</span> <span class="token number">1</span><span class="token punctuation">,</span> pmSupervisor<span class="token punctuation">)</span>

  <span class="token comment"># create interrupt stack frame on the kernel stack</span>
  <span class="token keyword">var</span> index <span class="token operator">=</span> kstack<span class="token operator">.</span>size <span class="token operator">div</span> <span class="token number">8</span>
  kstack<span class="token operator">.</span>data<span class="token punctuation">[</span>index <span class="token operator">-</span> <span class="token number">1</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>DataSegmentSelector<span class="token punctuation">)</span> <span class="token comment"># SS</span>
  kstack<span class="token operator">.</span>data<span class="token punctuation">[</span>index <span class="token operator">-</span> <span class="token number">2</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>ustack<span class="token operator">.</span>bottom<span class="token punctuation">)</span> <span class="token comment"># RSP</span>
  kstack<span class="token operator">.</span>data<span class="token punctuation">[</span>index <span class="token operator">-</span> <span class="token number">3</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span><span class="token number">0x202</span><span class="token punctuation">)</span> <span class="token comment"># RFLAGS</span>
  kstack<span class="token operator">.</span>data<span class="token punctuation">[</span>index <span class="token operator">-</span> <span class="token number">4</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>UserCodeSegmentSelector<span class="token punctuation">)</span> <span class="token comment"># CS</span>
  kstack<span class="token operator">.</span>data<span class="token punctuation">[</span>index <span class="token operator">-</span> <span class="token number">5</span><span class="token punctuation">]</span> <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>entryPoint<span class="token punctuation">)</span> <span class="token comment"># RIP</span>

  result<span class="token operator">.</span>id <span class="token operator">=</span> taskId
  result<span class="token operator">.</span>space <span class="token operator">=</span> uspace
  result<span class="token operator">.</span>ustack <span class="token operator">=</span> ustack
  result<span class="token operator">.</span>kstack <span class="token operator">=</span> kstack
  result<span class="token operator">.</span>rsp <span class="token operator">=</span> <span class="token function">cast[uint64]</span><span class="token punctuation">(</span>kstack<span class="token operator">.</span>data<span class="token punctuation">[</span>index <span class="token operator">-</span> <span class="token number">5</span><span class="token punctuation">]</span><span class="token operator">.</span><span class="token keyword">addr</span><span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Most of this code is not new, we just put it together in one place. The only new thing is calling <code>vmalloc</code> to allocate the user stack and kernel stack (which in turn allocates the backing physical memory). We no longer need to create global arrays to statically allocate the stacks.</p><h2 id="switching-to-a-task" tabindex="-1"><a class="header-anchor" href="#switching-to-a-task" aria-hidden="true">#</a> Switching to a task</h2><p>The part responsible for switching to a task was at the end of the <code>KernelMainInner</code> proc. Let&#39;s move it to the <code>tasks</code> module.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/tasks.nim</span>

<span class="token keyword">proc</span> <span class="token function">switchTo<span class="token operator">*</span></span><span class="token punctuation">(</span>task<span class="token operator">:</span> <span class="token keyword">var</span> Task<span class="token punctuation">)</span> <span class="token punctuation">{.</span>noreturn<span class="token punctuation">.}</span> <span class="token operator">=</span>
  tss<span class="token operator">.</span>rsp0 <span class="token operator">=</span> task<span class="token operator">.</span>kstack<span class="token operator">.</span>bottom
  <span class="token keyword">let</span> rsp <span class="token operator">=</span> task<span class="token operator">.</span>rsp
  <span class="token function">setActivePML4</span><span class="token punctuation">(</span>task<span class="token operator">.</span>space<span class="token operator">.</span>pml4<span class="token punctuation">)</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    mov rbp, 0
    mov rsp, %0
    iretq
    :
    : &quot;r&quot;(\`rsp\`)
  &quot;&quot;&quot;</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We update <code>tss.rsp0</code> to point to the kernel stack (so it can be used when the task switches to kernel mode), set the active page table to the task&#39;s page table, set the <code>rsp</code> register to the tasks&#39;s <code>rsp</code> field (which should point to the interrupt stack frame), and then execute <code>iretq</code> to switch to the task.</p><h2 id="trying-it-out" tabindex="-1"><a class="header-anchor" href="#trying-it-out" aria-hidden="true">#</a> Trying it out</h2><p>We can now replace a big chunk of the code we had in <code>KernelMainInner</code> with a call to <code>createTask</code> and <code>switchTo</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">KernelMain</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token operator">...</span>

  debugln <span class="token string">&quot;kernel: Creating user task&quot;</span>
  <span class="token keyword">var</span> task <span class="token operator">=</span> <span class="token function">createTask</span><span class="token punctuation">(</span>
    imageVirtAddr <span class="token operator">=</span> UserImageVirtualBase<span class="token operator">.</span>VirtAddr<span class="token punctuation">,</span>
    imagePhysAddr <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePhysicalBase<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span>
    imagePageCount <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePages<span class="token punctuation">,</span>
    entryPoint <span class="token operator">=</span> UserImageVirtualBase<span class="token operator">.</span>VirtAddr
  <span class="token punctuation">)</span>

  debug <span class="token string">&quot;kernel: Initializing Syscalls &quot;</span>
  <span class="token function">syscallInit</span><span class="token punctuation">(</span>task<span class="token operator">.</span>kstack<span class="token operator">.</span>bottom<span class="token punctuation">)</span>
  debugln <span class="token string">&quot;[success]&quot;</span>

  debugln <span class="token string">&quot;kernel: Switching to user mode&quot;</span>
  <span class="token function">switchTo</span><span class="token punctuation">(</span>task<span class="token punctuation">)</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Let&#39;s try it out.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Initializing GDT [success]
kernel: Initializing IDT [success]
kernel: Creating user task
kernel: Initializing Syscalls [success]
kernel: Switching to user mode
syscall: num=2
syscall: print
user: Hello from user mode!
syscall: num=1
syscall: exit: code=0
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Great! It&#39;s nice to be able to encapsulate all the task information in a <code>Task</code> object, and to be able to create a task and switch to it with just a few lines of code.</p><p>There&#39;s one thing that I still don&#39;t like, which is that we initialize the system calls with the kernel stack of the task. The system call entry point should be able to switch to the current task&#39;s kernel stack on its own, without relying on a global variable for the kernel stack. Once we start having multiple tasks, we have to be able to switch to the kernel stack of the current task.</p><h2 id="tracking-the-current-task" tabindex="-1"><a class="header-anchor" href="#tracking-the-current-task" aria-hidden="true">#</a> Tracking the current task</h2><p>We can solve this problem by tracking the current task in a global variable. Let&#39;s add a <code>currentTask</code> variable to the <code>tasks</code> module, and set it in the <code>switchTo</code> proc. One thing we&#39;ll do differently here is that we&#39;ll add the <code>exportc</code> pragma to this variable, so that we can access it from inline assembly later.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/tasks.nim</span>

<span class="token keyword">var</span>
  currentTask<span class="token operator">*</span> <span class="token punctuation">{.</span>exportc<span class="token punctuation">.}</span><span class="token operator">:</span> Task

<span class="token keyword">proc</span> <span class="token function">switchTo<span class="token operator">*</span></span><span class="token punctuation">(</span>task<span class="token operator">:</span> <span class="token keyword">var</span> Task<span class="token punctuation">)</span> <span class="token punctuation">{.</span>noreturn<span class="token punctuation">.}</span> <span class="token operator">=</span>
  currentTask <span class="token operator">=</span> task
  <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Now, we can change the system call entry point to switch to the current task&#39;s kernel stack.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>

<span class="token keyword">import</span> tasks
<span class="token operator">...</span>

<span class="token keyword">var</span>
  syscallTable<span class="token operator">:</span> array<span class="token punctuation">[</span><span class="token number">256</span><span class="token punctuation">,</span> SyscallHandler<span class="token punctuation">]</span>
  tss <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span><span class="token operator">:</span> TaskStateSegment
  currentTask <span class="token punctuation">{.</span>importc<span class="token punctuation">.}</span><span class="token operator">:</span> Task

<span class="token keyword">proc</span> <span class="token function">syscallEntry</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{.</span>asmNoStackFrame<span class="token punctuation">.}</span> <span class="token operator">=</span>
  <span class="token keyword">asm</span> <span class="token string">&quot;&quot;&quot;
    # switch to kernel stack
    mov %0, rsp
    mov rsp, %1

    ...

    # switch to user stack
    mov rsp, %0

    sysretq
    : &quot;+r&quot;(\`currentTask\`-&gt;rsp)
    : &quot;m&quot;(\`currentTask\`-&gt;kstack.bottom)
    : &quot;rcx&quot;, &quot;r11&quot;, &quot;rdi&quot;, &quot;rsi&quot;, &quot;rdx&quot;, &quot;rcx&quot;, &quot;r8&quot;, &quot;r9&quot;, &quot;rax&quot;
  &quot;&quot;&quot;</span>
</code></pre><div class="highlight-lines"><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><br><br><br><br><br><br><br><br><br><br><br><br><br><div class="highlight-line"> </div><div class="highlight-line"> </div><br><br></div><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>We can now remove the argument to <code>syscallInit</code>.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/syscalls.nim</span>
<span class="token operator">...</span>

<span class="token keyword">proc</span> <span class="token function">syscallInit<span class="token operator">*</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>And make the corresponding change in <code>KernelMainInner</code>. Also, since we don&#39;t need the kernel stack to initialize system calls anymore, we can move the call to <code>syscallInit</code> before creating the task.</p><div class="language-nim line-numbers-mode" data-ext="nim"><pre class="language-nim"><code><span class="token comment"># src/kernel/main.nim</span>

<span class="token keyword">proc</span> <span class="token function">KernelMainInner</span><span class="token punctuation">(</span>bootInfo<span class="token operator">:</span> <span class="token keyword">ptr</span> BootInfo<span class="token punctuation">)</span> <span class="token operator">=</span>
  <span class="token operator">...</span>

  debug <span class="token string">&quot;kernel: Initializing Syscalls &quot;</span>
  <span class="token function">syscallInit</span><span class="token punctuation">(</span><span class="token punctuation">)</span>
  debugln <span class="token string">&quot;[success]&quot;</span>

  debugln <span class="token string">&quot;kernel: Creating user task&quot;</span>
  <span class="token keyword">var</span> task <span class="token operator">=</span> <span class="token function">createTask</span><span class="token punctuation">(</span>
    imageVirtAddr <span class="token operator">=</span> UserImageVirtualBase<span class="token operator">.</span>VirtAddr<span class="token punctuation">,</span>
    imagePhysAddr <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePhysicalBase<span class="token operator">.</span>PhysAddr<span class="token punctuation">,</span>
    imagePageCount <span class="token operator">=</span> bootInfo<span class="token operator">.</span>userImagePages<span class="token punctuation">,</span>
    entryPoint <span class="token operator">=</span> UserImageVirtualBase<span class="token operator">.</span>VirtAddr
  <span class="token punctuation">)</span>

  debugln <span class="token string">&quot;kernel: Switching to user mode&quot;</span>
  <span class="token function">switchTo</span><span class="token punctuation">(</span>task<span class="token punctuation">)</span>

  <span class="token operator">...</span>
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Much simpler. Let&#39;s try it out.</p><div class="language-text line-numbers-mode" data-ext="text"><pre class="language-text"><code>kernel: Initializing GDT [success]
kernel: Initializing IDT [success]
kernel: Initializing Syscalls [success]
kernel: Creating user task
kernel: Switching to user mode
syscall: num=2
syscall: print
user: Hello from user mode!
syscall: num=1
syscall: exit: code=0
</code></pre><div class="line-numbers" aria-hidden="true"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>All good! We&#39;re in a much better place than we were before.</p><p>Ideally, we should now be able to create multiple tasks and switch between them. But, since we&#39;re creating a single address space OS, we need to be able to load tasks at different virtual addresses. So far, we&#39;ve been using a fixed virtual address for the user task; i.e. the task image is not relocatable. This means we have to link every user program at a different virtual address, which is not ideal. Traditional operating systems use a separate address space for each task, so linking the task image at a fixed virtual address is not a problem. In our case, we need to make the task image relocatable, so that we can load it at an arbitrary virtual address. That&#39;s what we&#39;ll do next.</p>`,53),p=[o];function i(c,l){return n(),a("div",null,p)}const d=s(t,[["render",i],["__file","19-tasks.html.vue"]]);export{d as default};
