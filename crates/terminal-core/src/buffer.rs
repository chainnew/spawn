use std::collections::VecDeque;

pub struct TerminalBuffer {
    lines: VecDeque<String>,
    max_lines: usize,
    current_line: String,
}

impl TerminalBuffer {
    pub fn new(max_lines: usize) -> Self {
        Self {
            lines: VecDeque::with_capacity(max_lines),
            max_lines,
            current_line: String::new(),
        }
    }

    pub fn push(&mut self, data: &[u8]) {
        for byte in data {
            if *byte == b'\n' {
                self.lines.push_back(std::mem::take(&mut self.current_line));
                if self.lines.len() > self.max_lines {
                    self.lines.pop_front();
                }
            } else if *byte != b'\r' {
                self.current_line.push(*byte as char);
            }
        }
    }

    pub fn get_all(&self) -> Vec<String> {
        self.lines.iter().cloned().collect()
    }

    pub fn get_recent(&self, n: usize) -> Vec<String> {
        self.lines.iter().rev().take(n).rev().cloned().collect()
    }

    pub fn clear(&mut self) {
        self.lines.clear();
        self.current_line.clear();
    }

    pub fn len(&self) -> usize {
        self.lines.len()
    }

    pub fn is_empty(&self) -> bool {
        self.lines.is_empty()
    }
}
