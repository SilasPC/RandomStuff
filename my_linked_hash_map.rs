//! My very own (probably buggy and unsafe) linked hashmap...
//! Insertion order is preserved

use std::hash::{Hash,Hasher};
use std::collections::hash_map::DefaultHasher;
use std::{ptr,mem};

#[test]
fn test_everything() {
    let mut map = LinkedHashMap::new();
    assert_eq!(map.capacity(), INIT_CAPACITY);
    map.insert(3,1);
    map.insert(2,0);
    map.insert(1,2);
    map.insert(0,0);
    map.insert(4,3);
    map.insert(2,4);
    assert_eq!(map.remove(&0),Some(0));
    assert_eq!(map.len(),4);
    println!("Iter:");
    for (i,(k,v)) in map.iter_mut().enumerate() {
        println!("{} : {} => {}",i,k,v);
        assert_eq!(i+1,*v);
    }
    assert_eq!(map.remove(&2),Some(4));
    assert_eq!(map.len(),3);
    map.insert(7,4);
    map.insert(6,0);
    map.insert(5,5);
    map.insert(9,6);
    map.insert(6,7);
    assert_eq!(map.len(),7);
    assert_eq!(map.capacity(),2 * INIT_CAPACITY);
    println!("Iter after resize:");
    for (i,(k,v)) in map.iter_mut().enumerate() {
        println!("{} : {} => {}",i,k,v);
        assert_eq!(i+1,*v);
    }
}

/// I'm too stupid, so this shall suffice
fn hash_idx<H>(h: &H, m: usize) -> usize where H: Hash {
    let mut hasher = DefaultHasher::default();
    h.hash(&mut hasher);
    (hasher.finish() % (m as u64)) as usize
}

/// The pointers in here should be considered as having the same mutability
/// as the binding. That is, a &Node should not be used for mutating.
struct Node<K, V> {
    pub prev: *mut Node<K, V>,
    pub next: *mut Node<K, V>,
    pub key: K,
    pub value: V,
}
const INIT_CAPACITY: usize = 8;

/// Nodes are owned by the map, and references passed outside 
/// should always be bound by a lifetime.
/// Internal usage of pointers should follow the aliasing rules.
/// That is, an aliased map should never mutate nodes
/// With this, &self can always safely access nodes,
/// and &mut self can always safely mutate nodes.
/// With all of this
pub struct LinkedHashMap<K: Eq + Hash, V> {
    first: *mut Node<K, V>,
    last: *mut Node<K, V>,
    bins: Vec<Vec<*mut Node<K,V>>>,
    len: usize,
}

pub struct Iter<'r,K,V> {
    cur: *const Node<K,V>,
    mkr: std::marker::PhantomData<&'r (K,V)>
}

impl<'r,K,V> std::iter::Iterator for Iter<'r,K,V> {
    type Item = (&'r K, &'r V);
    fn next(&mut self) -> Option<Self::Item> {
        if self.cur.is_null() {return None}
        let Node {
            ref key,
            ref value,
            next,
            ..
        } = unsafe{&*self.cur};
        self.cur = *next;
        Some((key,value))
    }
}

pub struct IterMut<'r,K,V> {
    cur: *mut Node<K,V>,
    mkr: std::marker::PhantomData<&'r mut (K,V)>
}

impl<'r,K,V> std::iter::Iterator for IterMut<'r,K,V> {
    type Item = (&'r mut K, &'r mut V);
    fn next(&mut self) -> Option<Self::Item> {
        if self.cur.is_null() {return None}
        let Node {
            ref mut key,
            ref mut value,
            next,
            ..
        } = unsafe{&mut *self.cur};
        self.cur = *next;
        Some((key,value))
    }
}

impl<K: Eq + Hash,V> LinkedHashMap<K, V> {
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            first: ptr::null_mut(),
            last: ptr::null_mut(),
            bins: vec![vec![];capacity],
            len: 0,
        }
    }
    pub fn new() -> Self {
        Self {
            first: ptr::null_mut(),
            last: ptr::null_mut(),
            bins: vec![vec![];INIT_CAPACITY],
            len: 0,
        }
    }
    pub fn get(&self, k: &K) -> Option<&V> {
        self.find_node(k).1
            .map(|node| unsafe {&(*node).value})
    }
    pub fn get_mut(&self, k: &K) -> Option<&mut V> {
        self.find_node(k).1
            .map(|node| unsafe {&mut (*node).value})
    }
    fn find_node(&self, k: &K) -> (usize,Option<*mut Node<K,V>>) {
        let idx = hash_idx(k,self.bins.len());
        let node = self.bins[idx]
            .iter()
            .filter(|p| unsafe{&***p}.key == *k) // Nobody may mutate while we have a &self
            .next()
            .map(|n| *n);
        (idx, node)
    }
    pub fn remove(&mut self, k: &K) -> Option<V> {
        // &mut self, so no external node references
        let (_idx, node) = self.find_node(k);
        let node = node?;
        unsafe{self.dechain(node)};
        // No more internal references to node
        // Drop node and move value out
        let Node { value, .. } = *unsafe {Box::from_raw(node)};
        self.len -= 1;
        Some(value)
    }
    pub fn insert(&mut self, k: K, v: V) -> Option<V> {
        if self.len >= 3 * self.bins.capacity() / 4 {self.resize()}
        let (idx,node) = self.find_node(&k);
        match node {
            Some(p) => {
                unsafe {
                    self.dechain(p);
                    (*p).next = ptr::null_mut();
                    (*p).prev = self.last;
                    if !self.last.is_null() {
                        (*self.last).next = p;
                    }
                    self.last = p;
                    Some(mem::replace(&mut (*p).value, v))
                }
            }
            None => {
                let node = Box::leak(Box::new(Node {
                    prev: self.last,
                    next: ptr::null_mut(),
                    key: k,
                    value: v,
                }));
                if !self.last.is_null() {
                    unsafe {&mut *self.last}.next = node;
                }
                self.last = node;
                if self.len == 0 {
                    self.first = node;
                }
                self.bins[idx].push(node);
                self.len += 1;
                None
            }
        }
    }
    unsafe fn dechain(&mut self, node: *mut Node<K,V>) {
        let next = (*node).next;
        let prev = (*node).prev;
        if !next.is_null() {
            (*next).prev = prev;
        }
        if !prev.is_null() {
            (*prev).next = next;
        }
        if self.first == node {
            self.first = next;
        }
        if self.last == node {
            self.last = prev;
        }
    }
    fn resize(&mut self) {
        let size = self.bins.len() * 2;
        let mut bins = vec![vec![]; size];
        for &n in self.bins.iter().flat_map(|b|b.iter()) {
            // &mut self gives exclusive access, so reading is fine
            let idx = hash_idx(&unsafe{&*n}.key, size);
            bins[idx].push(n);
        }
        self.bins = bins;
    }
    pub fn len(&self) -> usize {self.len}
    pub fn capacity(&self) -> usize {self.bins.len()}
    pub fn iter_mut<'r>(&'r mut self) -> IterMut<'r, K, V> {
        IterMut {
            cur: self.first,
            mkr: std::marker::PhantomData,
        }
    }
    pub fn iter<'r>(&'r self) -> Iter<'r, K, V> {
        Iter {
            cur: self.first,
            mkr: std::marker::PhantomData,
        }
    }
}

impl<K: Eq + Hash,V> Drop for LinkedHashMap<K,V> {
    fn drop(&mut self) {
        unsafe {
            // Probably not the most efficient, but who cares
            let mut cur: *mut Node<K,V> = self.first;
            while !cur.is_null() {
                let to_drop = cur;
                cur = (*cur).next;
                to_drop.drop_in_place();
            }
        }
    }
}
