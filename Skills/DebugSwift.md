---
name: Debug Swift / iOS
trigger: debug swift, iOS bug, xcode debugger, swift crash, NSException, EXC_BAD_ACCESS, swift memory leak, instruments xcode, iOS crash log, SwiftUI bug, UIKit bug, retain cycle, async swift bug, actor swift, swift concurrency bug, Core Data bug
description: Systematically diagnose and fix bugs in Swift and iOS apps. Covers Xcode debugger, crash log analysis, memory leaks, retain cycles, SwiftUI state bugs, async/await issues, and Instruments profiling.
---

# ROLE
You are an iOS engineer with deep Swift and Xcode expertise. Your job is to help diagnose and fix bugs efficiently — from interpreting crash logs to hunting retain cycles to untangling async/await race conditions. Every bug has a cause; your job is to find it systematically.

# READING CRASH LOGS

## Symbolicated Crash Report Structure
```
Incident Identifier: [UUID]
Date/Time:           2024-01-15 10:30:45
OS Version:          iPhone OS 17.2
Exception Type:      EXC_BAD_ACCESS (SIGSEGV)  ← what crashed
Exception Codes:     KERN_INVALID_ADDRESS at 0x0000000000000008  ← nil + 8 byte offset
Crashed Thread:      0  ← usually 0 = main thread; background threads = concurrency issue

Thread 0 Backtrace:
0   MyApp                     0x0000001 OrderViewModel.loadOrders() + 42
1   MyApp                     0x0000002 OrderViewController.viewDidLoad() + 128
2   UIKitCore                 0x0000003 UIViewController.loadViewIfNeeded()

→ Crash in loadOrders() called from viewDidLoad
→ EXC_BAD_ACCESS = accessing freed memory or nil pointer
→ KERN_INVALID_ADDRESS at 0x8 = accessed property on a nil object (offset 8 bytes into nil)
```

## Common Exception Types
```
EXC_BAD_ACCESS (SIGSEGV/SIGBUS):
  → Accessing nil/deallocated memory
  → Common: force-unwrapping nil optional, accessing weak ref after dealloc, use-after-free
  → Enable: Scheme → Diagnostics → Address Sanitizer + Zombie Objects

NSException "NSInternalInconsistencyException":
  → UITableView/UICollectionView data source inconsistency
  → Thrown when: reloadData() during batch update, section/row count mismatch
  → Fix: wrap batch updates in performBatchUpdates; audit data source consistency

NSException "NSRangeException":
  → Array index out of bounds, string range invalid
  → Find the line; add bounds check before access

EXC_CRASH (SIGABRT):
  → Assertion failed (assert, precondition), force-unwrap nil, fatalError
  → Stack trace points directly to the assertion or force-unwrap

Thread violation crashes:
  → "UIKit must be used from main thread only"
  → Enable: Scheme → Diagnostics → Main Thread Checker
```

# XCODE DEBUGGER

## Essential Debugging Workflow
```swift
// 1. BREAKPOINTS — smarter than print

// Exception breakpoint: catches ALL exceptions before they crash
//   Debug menu → Breakpoints → Add Exception Breakpoint (Swift + ObjC)
//   → Shows exact line that threw, not the crash stack

// Symbolic breakpoint: break in any method by name
//   + → Symbolic Breakpoint → Symbol: "MyClass.myMethod"

// Conditional breakpoint: only break when condition is true
//   Right-click breakpoint → Edit → Condition: "index > 100"

// Action: run LLDB expression when breakpoint fires (no recompile needed)
//   Right-click → Edit → Action: "po self.viewModel.items.count"

// 2. LLDB COMMANDS
// po (print object) — calls description on any object
(lldb) po viewModel
(lldb) po viewModel.items.count
(lldb) po error.localizedDescription

// p (print) — value of expression
(lldb) p items.count

// expression — evaluate and change state at runtime
(lldb) expression viewModel.isLoading = false  // change state without restart

// bt (backtrace) — current call stack
(lldb) bt

// 3. VIEW DEBUGGER
// Debug → View Debugging → Capture View Hierarchy
// → 3D decomposed view of all layers
// → Find overlapping/invisible views, constraint issues, clipped content
```

## Memory Graph Debugger (Retain Cycle Detection)
```swift
// Runtime: Debug → Memory Graph (purple button)
// → Shows object graph with arrows for strong references
// → Look for cycles: A → B → A (both survive forever)

// Most common retain cycle patterns:

// WRONG: closure captures self strongly
class ProfileViewModel: ObservableObject {
    var dataTask: URLSessionDataTask?
    
    func loadProfile() {
        dataTask = URLSession.shared.dataTask(with: url) { data, _, _ in
            // ⚠️ self captured strongly — ViewModel never deallocated
            self.profile = try? JSONDecoder().decode(Profile.self, from: data!)
        }
    }
}

// FIXED: weak self in closure
func loadProfile() {
    dataTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
        guard let self else { return }
        self.profile = try? JSONDecoder().decode(Profile.self, from: data!)
    }
}

// Delegation retain cycle (delegate holds the delegating object):
// WRONG:
class MyViewController: UIViewController {
    var service = NetworkService()
    init() { service.delegate = self }  // service has strong ref to VC
}
class NetworkService {
    var delegate: MyViewController?   // ⚠️ strong — cycle!
}
// FIXED: weak delegate
class NetworkService {
    weak var delegate: NetworkServiceDelegate?  // weak breaks the cycle
}
```

# SWIFT CONCURRENCY DEBUGGING

## async/await Issues
```swift
// BUG: actor-isolated property accessed from non-isolated context
@MainActor
class OrderViewModel: ObservableObject {
    @Published var orders: [Order] = []
    
    func loadOrders() async {
        let result = await api.fetchOrders()
        // ✓ This is fine — already on MainActor
        self.orders = result
    }
}

// BUG: Task not cancelled — memory leak
class SearchViewModel: ObservableObject {
    private var searchTask: Task<Void, Never>?
    
    func search(_ query: String) {
        // WRONG: previous task still running
        searchTask = Task {
            let results = await api.search(query)
            self.results = results
        }
    }
    
    // FIXED: cancel previous task before starting new one
    func search(_ query: String) {
        searchTask?.cancel()
        searchTask = Task {
            guard !Task.isCancelled else { return }
            let results = await api.search(query)
            guard !Task.isCancelled else { return }
            await MainActor.run { self.results = results }
        }
    }
}

// DATA RACE: two concurrent tasks mutating shared state
// Enable: Scheme → Diagnostics → Thread Sanitizer (TSan)
// TSan will report races at runtime

// FIX: use actor for shared mutable state
actor Cache {
    private var storage: [String: Data] = [:]
    
    func store(_ data: Data, for key: String) {
        storage[key] = data
    }
    
    func retrieve(for key: String) -> Data? {
        return storage[key]
    }
}
```

# SWIFTUI BUGS

## View Not Updating
```swift
// SYMPTOM: UI doesn't reflect model changes

// CAUSE 1: ObservableObject not used correctly
struct BadView: View {
    let viewModel = OrderViewModel()  // ⚠️ let — not observed
    var body: some View { Text(viewModel.status) }
}
// FIX: @StateObject (owns it) or @ObservedObject (receives it)
struct GoodView: View {
    @StateObject private var viewModel = OrderViewModel()
    var body: some View { Text(viewModel.status) }
}

// CAUSE 2: Mutation not triggering @Published
class OrderViewModel: ObservableObject {
    @Published var items: [Order] = []
    
    func updateFirst() {
        items[0].status = "shipped"  // ⚠️ mutating inside array — may not publish!
    }
    
    // FIX: trigger objectWillChange or replace the array
    func updateFirst() {
        var updated = items
        updated[0].status = "shipped"
        items = updated  // ✓ replacing the array triggers @Published
    }
}

// CAUSE 3: Wrong property wrapper for the use case
// @State:         local, value type, owned by this view
// @StateObject:   local, reference type, owned by this view (use for ViewModels)
// @ObservedObject: reference type, passed in from parent (don't use for local VMs)
// @EnvironmentObject: shared across view hierarchy via .environmentObject()
// @Binding:       read/write access to parent's @State
```

## Infinite View Update Loop
```swift
// SYMPTOM: app freezes or consumes 100% CPU; Xcode shows rapid view updates

// CAUSE: side effect inside a view's body triggers a state change → body re-runs → loop
struct BadView: View {
    @State private var data: [Item] = []
    
    var body: some View {
        List(data) { item in ItemRow(item: item) }
            .onAppear {
                // ⚠️ This runs every time body is recomputed when view appears
                data = loadData()  // triggers another body → infinite loop
            }
    }
}

// FIX: use .task for async loading, or .onAppear with a guard
struct GoodView: View {
    @State private var data: [Item] = []
    @State private var didLoad = false
    
    var body: some View {
        List(data) { item in ItemRow(item: item) }
            .task {  // runs once, cancels on disappear
                data = await api.loadItems()
            }
    }
}
```

# INSTRUMENTS

## Profiling Workflows
```
TOOL: Time Profiler — find CPU hotspots
  Record → interact → stop → examine Heaviest Stack Trace
  Look for: your code in the top entries (system code is expected)
  Callout: functions with unusually high % of total time
  Fix: look for O(n²) loops, synchronous work on main thread, inefficient string operations

TOOL: Leaks — find memory leaks
  Run → the Leaks instrument periodically checks for leaked objects
  Red marks = confirmed leaks; click → see object type and allocation callstack
  Most common: retain cycles (see Memory Graph section above)

TOOL: Allocations — track memory growth
  Filter by your module name
  Look for: objects that keep growing without plateauing (leaked or retained)
  "Allocations List" → sort by total size to find the big allocators

TOOL: Core Data — debug fetch performance
  Enable -com.apple.CoreData.SQLDebug 1 in scheme arguments
  → Prints all SQL queries to console
  Look for: N+1 patterns (100 queries for 100 objects — use relationships + prefetching)
```

# COMMON PATTERNS AND FIXES

```swift
// FORCE UNWRAP CRASH — most common iOS bug
// Bad:
let cell = tableView.dequeueReusableCell(withIdentifier: "Cell") as! MyCell
// Good:
guard let cell = tableView.dequeueReusableCell(withIdentifier: "Cell") as? MyCell else {
    fatalError("Failed to dequeue MyCell — check identifier and registration")
}

// THREAD VIOLATION — UI update off main thread
URLSession.shared.dataTask(with: url) { data, _, _ in
    // ⚠️ Background thread
    self.tableView.reloadData()  // crash: UI updated off main thread
    
    // FIX:
    DispatchQueue.main.async { self.tableView.reloadData() }
    // Or with async/await: await MainActor.run { self.tableView.reloadData() }
}.resume()

// TABLEVIEW INCONSISTENCY — classic crash
// "Invalid update: invalid number of rows in section 0"
// Cause: data source changes without matching insert/delete calls
// Fix: always update data source BEFORE calling insert/delete
dataSource.remove(at: indexPath.row)  // update model first
tableView.deleteRows(at: [indexPath], with: .fade)  // then animate
```
