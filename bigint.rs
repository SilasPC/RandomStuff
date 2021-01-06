//! Unfinished (probably bad) attempt at arbitrary precision arithmetic

#[test]
fn test() {
    let m = u64::MAX;
    let mut big: BigInt = BigInt(vec![m;1000]);//u64::MAX.into();
    println!("{}",big);
    /*big *= u64::MAX;
    big /= 10;
    println!("{}",big);*/
}

#[derive(PartialEq,Eq,Hash,Clone,Debug)]
struct BigInt(Vec<u64>);

use std::ops::*;

use std::fmt::{Display,Formatter,Result as FRes};
impl Display for BigInt {
    fn fmt(&self, f: &mut Formatter<'_>) -> FRes {
        if self.is_zero() {
            return write!(f,"0")
        }
        let mut c = self.clone();
        let mut digits = vec![];
        while !c.is_zero() {
            let rem = c.div_rem(10);
            digits.push((rem as u8 + b'0') as char);
        };
        digits.reverse();
        write!(f, "{}", digits.into_iter().collect::<String>())
    }
}

impl DivAssign<u64> for BigInt {
    fn div_assign(&mut self, rhs: u64) {
        self.div_rem(rhs);
    }
}

impl AddAssign<u64> for BigInt {
    fn add_assign(&mut self, rhs: u64) {
        let (res, of) = self.lst().overflowing_add(rhs);
        self.set_lst(res);
        if of {
            self.0.push(1);
        }
    }
}

impl Mul for BigInt {
    type Output = Self;
    fn mul(mut self, rhs: Self) -> Self {
        self.mul_assign(rhs);
        self
    }
}

impl MulAssign<u64> for BigInt {
    fn mul_assign(&mut self, rhs: u64) {
        let mask: u128 = u64::MAX as u128;
        let rhs = rhs as u128;
        let mut overflow = 0u128;
        for i in 0..self.0.len() {
            let res = self.0[i] as u128 * rhs + overflow;
            self.0[i] = (res & mask) as u64;
            overflow = res >> 64;
        }
        if overflow > 0 {
            self.0.push(overflow as u64);
        }
    }
}

impl MulAssign for BigInt {
    fn mul_assign(&mut self, rhs: Self) {
        let mut tmp = 0.into();
        std::mem::swap(&mut tmp, self);
        for (i,v) in rhs.0.iter().copied().enumerate() {
            self.add_mul_offset(&tmp, v, i)
        }
    }
}

impl Shr<usize> for BigInt {
    type Output = Self;
    #[inline(always)]
    fn shr(mut self, rhs: usize) -> Self {
        self >>= rhs;
        self
    }
}

impl ShrAssign<usize> for BigInt {
    fn shr_assign(&mut self, rhs: usize) {
        const BITS: usize = 0usize.leading_zeros() as usize;
        let offset = 1 + rhs / BITS;
        if offset > self.0.len() + 1 {
            self.0.truncate(1);
            self.0[0] = 0;
            return;
        }
        let rsh = rhs % BITS;
        if rsh == 0 {
            self.shr_size(offset-1);
            return;
        }
        let lsh = BITS - rsh;
        let mask = u64::MAX >> (lsh);
        for i in 0..self.0.len()-offset {
            let pat = self.0[i+offset] & mask;
            self.0[i] =
                (self.0[i] >> rsh) | pat;
        }
        self.0.truncate(self.0.len()+1-offset);
        if self.lst() == 0 && self.0.len() > 0 {
            self.0.truncate(self.0.len()-1);
        }
    }
}

impl Add for BigInt {
    type Output = BigInt;
    fn add(mut self, rhs: Self) -> Self {
        if rhs.0.len() > self.0.len() {
            self.0.resize(rhs.0.len(),0);
        }
        let mut overflowed = false;
        for i in 0..rhs.0.len() {
            let r = rhs.0[i];
            let (res,of) = self.0[i].overflowing_add(r);
            self.0[i] = if overflowed {res + 1} else {res};
            overflowed = of;
        }
        if overflowed {
            self.add_offset(1, rhs.0.len());
        }
        self
    }
}

impl From<u64> for BigInt {
    fn from(u:u64) -> Self {
        Self (vec![u])
    }
}

impl BigInt {
    /*pub fn from_decimal(s: &[u8]) -> Option<Self> {
        let mut num = 0.into();
        let mut us: usize = 0;
        for b in s.iter().copied().rev() {
            match b {
                b'0'..=b'9' => {
                    let c = b as usize - b'0' as usize;
                    let usr = us.checked_mul(10)
                        .and_then(|v| c.checked_add(c));
                    if let Some(usr) = usr {
                        us = usr;
                    } else {
                        num += us;
                        us = us.wrapping_add(c);
                    }
                }
                _ => return None
            }
        }
        num += us;
        Some(num)
    }*/
    pub fn div_rem(&mut self, rhs: u64) -> u64 {
        let rhs = rhs as u128;
        let mut carry = 0u128;
        for v in self.0.iter_mut().rev() {
            let val = *v as u128 + carry * (u64::MAX as u128 + 1);
            let q = val / rhs;
            let r = val % rhs;
            *v = q as u64;
            carry = r;
        }
        if self.0.len() > 1 && self.lst() == 0 {
            self.0.pop();
        }
        carry as u64
    }
    pub fn is_zero(&self) -> bool {
        self.0.len() == 1 && self.0[0] == 0
    }
    pub fn shr_size(&mut self, s: usize) {
        let s = s.min(self.0.len());
        self.0.splice(0..s,std::iter::empty());
    }
    fn add_mul_offset(&mut self, rhs: &Self, mul: u64, offset: usize) {
        let mask: u128 = u64::MAX as u128;
        if self.0.len() < rhs.0.len() + offset {
            self.0.resize(rhs.0.len() + offset, 0);
        }
        let mul = mul as u128;
        let mut overflow = 0u128;
        for (i,v) in rhs.0.iter().copied().enumerate() {
            let oi = offset + i;
            let res = v as u128 * mul + overflow + self.0[oi] as u128;
            self.0[oi] = (res & mask) as u64;
            overflow = res >> 64;
        }
        self.add_offset(overflow as u64, rhs.0.len()+offset);
    }
    fn add_offset(&mut self, mut val: u64, mut i: usize) {
        if i > self.0.len() {
            panic!("lol")
        } else if i == self.0.len() {
            self.0.push(val);
            return;
        }
        let mut overflowed = false;
        while i < self.0.len() {
            let (res,of) = self.0[i].overflowing_add(val);
            self.0[i] = if overflowed {res+1} else {res};
            if !of {return}
            overflowed = true;
            val = 1;
            i += 1;
        }
        self.0.push(1);
    }
    #[inline(always)]
    fn lst(&self) -> u64 {
        *self.0.last().unwrap()
    }
    #[inline(always)]
    fn set_lst(&mut self, v: u64) {
        *self.0.last_mut().unwrap() = v
    }
}
