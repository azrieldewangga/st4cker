#!/usr/bin/env python3
"""
NLU Module - Natural Language Understanding
Conversational parsing, bukan keyword matching

Detect intent tapi tetap conversational - kalau ambiguous, flag untuk clarification
"""

import re
from typing import Dict, Any, Optional, List

class NLU:
    """
    Natural Language Understanding dengan approach conversational.
    Bukan keyword matching rigid, tapi intent extraction dengan context awareness.
    """
    
    def __init__(self):
        # Course aliases untuk matching
        self.course_aliases = {
            "kjk": ["keamanan jaringan", "kjk", "keamanan", "k j k"],
            "komber": ["komputasi bergerak", "komber", "kb", "komputasi bergerak", "komputasi"],
            "ppl": ["pengembangan perangkat lunak", "ppl", "perangkat lunak"],
            "sister": ["sistem terdistribusi", "sister", "sist", "sis ter"],
            "pemjar": ["pemrograman jaringan", "pemjar", "pj", "pemrograman jaringan"],
            "wspk": ["workshop spk", "wspk", "spk", "workshop"],
        }
        
        # Problem indicators - untuk detect ada masalah
        self.problem_indicators = [
            "macet", "sakit", "cancel", "gajadi", "gak jadi", "skip", 
            "batal", "gak bisa", "tidak bisa", "urusan", "ada acara",
            "ngantuk", "bangun telat", "ketiduran", " males ", "mager",
            "dimarasi", "ada kerjaan", "di perusahaan", "dikantor"
        ]
        
        # Reschedule indicators - untuk detect pindah jadwal
        self.reschedule_indicators = [
            "pindah", "geser", " reschedule", "diundur", "dimajukan",
            "ganti hari", "ganti jam", "minggu depan", "besok aja",
            "hari lain", "jam lain", "nanti aja", "next week"
        ]
        
        # Confirm indicators
        self.confirm_indicators = [
            "ok", "oke", "okee", "gas", "otw", "on the way", "iya", "ya", 
            "yoi", "siap", "siapp", "yuk", "ayo", "lanjut", "gaskeun",
            "let's go", "lets go", "baik", "mantap", "iyaa", "yaa", "okeh",
            "berangkat", "jalan", "udah", "sudah"
        ]
        
        # Resume indicators
        self.resume_indicators = [
            "lanjut", "bisa", "gas lagi", "otw sekarang", "jadi",
            "lanjut kuliah", "bisa ke kampus", "resume"
        ]
        
        # Stuck/need help indicators
        self.stuck_indicators = [
            "stuck", "buntu", "gak ngerti", "bingung", "pusing", "susah",
            "gak bisa lanjut", "mentok", "butuh bantuan", "tolong", "help"
        ]
        
        # Progress indicators
        self.progress_indicators = [
            "baru", "sudah", "udah", "done", "selesai", "progress",
            "persen", "%", "setengah", "separuh", "sepertiga", "seperempat"
        ]
        
        # New task indicators
        self.new_task_indicators = [
            "tugas baru", "ditambah tugas", "dikasih tugas",
            "baru keluar tugas", "tugas mendadak"
        ]
        
        # List tasks indicators
        self.list_tasks_indicators = [
            "list tugas", "daftar tugas", "tugas apa", "ada tugas",
            "tugasku", "tugas gue", "lihat tugas", "cek tugas", "tugas pending",
            "berapa tugas", "tugas apa aja", "semua tugas"
        ]
        
        # List schedules indicators
        self.list_schedules_indicators = [
            "jadwal", "kuliah hari ini", "ada matkul apa", "matkul hari ini",
            "schedule", "kelas hari ini", "ada kelas apa", "lihat jadwal",
            "cek jadwal", "jadwal kuliah", "jam berapa kelas", "besok ada kuliah"
        ]
        
        # Check balance indicators
        self.check_balance_indicators = [
            "saldo", "duit", "uang", "balance", "tabungan", "sisa uang",
            "duit berapa", "uang sisa", "cek saldo", "lihat saldo", "sisa duit"
        ]
        
        # List projects indicators
        self.list_projects_indicators = [
            "project", "proyek", "list project", "daftar project",
            "cek project", "lihat project", "project apa aja"
        ]
        
        # List transactions indicators
        self.list_transactions_indicators = [
            "transaksi", "pengeluaran", "pemasukan", "list transaksi",
            "cek transaksi", "lihat transaksi", "uang keluar", "uang masuk"
        ]
        
        # Create task indicators
        self.create_task_indicators = [
            "tambah tugas", "buat tugas", "input tugas", "catat tugas",
            "tugas baru", "ada tugas", "ditambah tugas", "dikasih tugas",
            "baru keluar tugas", "tugas mendadak", "nambah tugas"
        ]
        
        # Create project indicators
        self.create_project_indicators = [
            "buat project", "tambah project", "input project", "catat project",
            "project baru", "nambah project", "mulai project", "bikin project"
        ]
        
        # Create transaction indicators
        self.create_transaction_indicators = [
            "catat pengeluaran", "catat pemasukan", "tambah pengeluaran", 
            "tambah pemasukan", "input pengeluaran", "input pemasukan",
            "nambah pengeluaran", "nambah pemasukan", "beli", "bayar",
            "habis duit", "dapet uang", "terima uang", "transfer"
        ]
        
        # Log progress indicators
        self.log_progress_indicators = [
            "log progress", "update progress", "catat progress",
            "progress project", "tambah progress", "update project",
            "udah kerja", "sudah ngerjain", "progress berapa"
        ]
    
    def parse(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse message menjadi intent dengan conversational approach.
        
        Returns:
            {
                "intent": str,
                "confidence": float,
                "needs_clarification": bool,
                "clarification_question": str (optional),
                "extracted": dict
            }
        """
        msg_lower = message.lower().strip()
        
        # Check for resume intent (kembali setelah cancel)
        if self._is_resume(msg_lower):
            return {
                "intent": "resume_attendance",
                "confidence": 0.9,
                "needs_clarification": False,
                "extracted": {}
            }
        
        # Check for list tasks
        if self._is_list_tasks(msg_lower):
            filters = self._extract_task_filters(msg_lower)
            return {
                "intent": "list_tasks",
                "confidence": 0.9,
                "needs_clarification": False,
                "extracted": filters
            }
        
        # Check for list schedules
        if self._is_list_schedules(msg_lower):
            day = self._extract_day(msg_lower)
            return {
                "intent": "list_schedules",
                "confidence": 0.9,
                "needs_clarification": False,
                "extracted": {"day": day}
            }
        
        # Check for check balance
        if self._is_check_balance(msg_lower):
            return {
                "intent": "check_balance",
                "confidence": 0.95,
                "needs_clarification": False,
                "extracted": {}
            }
        
        # Check for list projects
        if self._is_list_projects(msg_lower):
            return {
                "intent": "list_projects",
                "confidence": 0.9,
                "needs_clarification": False,
                "extracted": {}
            }
        
        # Check for list transactions
        if self._is_list_transactions(msg_lower):
            return {
                "intent": "list_transactions",
                "confidence": 0.9,
                "needs_clarification": False,
                "extracted": {}
            }
        
        # Check for create task
        if self._is_create_task(msg_lower):
            extracted = self._extract_task_info(message)
            return {
                "intent": "create_task",
                "confidence": 0.85,
                "needs_clarification": True,
                "clarification_question": "task_details",
                "extracted": extracted
            }
        
        # Check for create project
        if self._is_create_project(msg_lower):
            return {
                "intent": "create_project",
                "confidence": 0.85,
                "needs_clarification": True,
                "clarification_question": "project_details",
                "extracted": {}
            }
        
        # Check for create transaction (expense/income)
        if self._is_create_transaction(msg_lower):
            extracted = self._extract_transaction_info(message)
            return {
                "intent": "create_transaction",
                "confidence": 0.85,
                "needs_clarification": extracted.get("amount") is None,
                "clarification_question": "transaction_amount" if extracted.get("amount") is None else None,
                "extracted": extracted
            }
        
        # Check for log progress
        if self._is_log_progress(msg_lower):
            progress = self._extract_percentage(msg_lower)
            return {
                "intent": "log_progress",
                "confidence": 0.85,
                "needs_clarification": progress is None,
                "clarification_question": "progress_value" if progress is None else None,
                "extracted": {"progress": progress}
            }
        
        # Check for new task report
        if self._is_new_task(msg_lower):
            extracted = self._extract_task_info(message)
            return {
                "intent": "new_task",
                "confidence": 0.85,
                "needs_clarification": True,  # Perlu tanya individual/group, estimasi
                "clarification_question": "task_details",
                "extracted": extracted
            }
        
        # Check for progress update
        progress = self._extract_percentage(msg_lower)
        if progress is not None:
            task = self._extract_task(message, context)
            return {
                "intent": "update_progress",
                "confidence": 0.9,
                "needs_clarification": False,
                "extracted": {
                    "progress": progress,
                    "task": task
                }
            }
        
        # Check for stuck/need help
        if self._is_stuck(msg_lower):
            return {
                "intent": "need_help",
                "confidence": 0.85,
                "needs_clarification": True,
                "clarification_question": "help_type",
                "extracted": {}
            }
        
        # Check for problem/cancel intent
        if self._has_problem(msg_lower):
            scope = self._extract_scope(message)
            reason = self._extract_reason(msg_lower)
            course = self._extract_course(message) or context.get("last_course", "")
            
            if scope:
                # User already specified scope
                return {
                    "intent": "cancel",
                    "confidence": 0.9,
                    "needs_clarification": False,
                    "extracted": {
                        "scope": scope,
                        "reason": reason,
                        "course": course
                    }
                }
            else:
                # Ambiguous - need clarification
                return {
                    "intent": "potential_cancel",
                    "confidence": 0.7,
                    "needs_clarification": True,
                    "clarification_question": "scope",
                    "extracted": {
                        "problem": self._extract_problem_type(msg_lower),
                        "affected_course": course,
                        "reason": reason
                    }
                }
        
        # Check for confirmation
        if self._is_confirm(msg_lower):
            return {
                "intent": "confirm_attendance",
                "confidence": 0.9,
                "needs_clarification": False,
                "extracted": {}
            }
        
        # Check for task selection
        task_selection = self._extract_task_selection(message, context)
        if task_selection:
            return {
                "intent": "select_task",
                "confidence": 0.85,
                "needs_clarification": False,
                "extracted": task_selection
            }
        
        # Fallback - unclear intent
        return {
            "intent": "unknown",
            "confidence": 0.0,
            "needs_clarification": True,
            "clarification_question": "general",
            "extracted": {"raw_message": message}
        }
    
    def _is_resume(self, msg_lower: str) -> bool:
        """Check if user wants to resume after cancel."""
        for indicator in self.resume_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_new_task(self, msg_lower: str) -> bool:
        """Check if user reporting new task."""
        for indicator in self.new_task_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_list_tasks(self, msg_lower: str) -> bool:
        """Check if user wants to list tasks."""
        for indicator in self.list_tasks_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_list_schedules(self, msg_lower: str) -> bool:
        """Check if user wants to list schedules."""
        for indicator in self.list_schedules_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_check_balance(self, msg_lower: str) -> bool:
        """Check if user wants to check balance."""
        for indicator in self.check_balance_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_list_projects(self, msg_lower: str) -> bool:
        """Check if user wants to list projects."""
        for indicator in self.list_projects_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_list_transactions(self, msg_lower: str) -> bool:
        """Check if user wants to list transactions."""
        for indicator in self.list_transactions_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _extract_task_filters(self, msg_lower: str) -> Dict:
        """Extract filters for task listing."""
        filters = {}
        
        # Status filter
        if "pending" in msg_lower or "belum" in msg_lower:
            filters["status"] = "pending"
        elif "completed" in msg_lower or "selesai" in msg_lower or "done" in msg_lower:
            filters["status"] = "completed"
        
        # Course filter
        course = self._extract_course(msg_lower)
        if course:
            filters["course"] = course
        
        return filters
    
    def _extract_day(self, msg_lower: str) -> Optional[str]:
        """Extract day from message."""
        days = {
            "senin": "Senin", "selasa": "Selasa", "rabu": "Rabu",
            "kamis": "Kamis", "jumat": "Jumat", "sabtu": "Sabtu", "minggu": "Minggu",
            "hari ini": "today", "besok": "tomorrow"
        }
        
        for key, value in days.items():
            if key in msg_lower:
                return value
        
        return None
    
    def _is_stuck(self, msg_lower: str) -> bool:
        """Check if user is stuck/need help."""
        for indicator in self.stuck_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _has_problem(self, msg_lower: str) -> bool:
        """Check if user indicating a problem/issue."""
        for indicator in self.problem_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_reschedule(self, msg_lower: str) -> bool:
        """Check if user wants to reschedule (pindah jadwal)."""
        for indicator in self.reschedule_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_confirm(self, msg_lower: str) -> bool:
        """Check if user confirming/accepting."""
        for indicator in self.confirm_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _extract_percentage(self, msg_lower: str) -> Optional[int]:
        """Extract percentage from message."""
        # Pattern: "60%", "60 persen", "baru 60%", "udah 60"
        patterns = [
            r'(?:baru|udah|sudah|done|selesai)?\s*(\d+)(?:\s*%|\s*persen)',
            r'(?:baru|udah|sudah)\s+(\d+)(?:\s*%|\s*persen)?',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, msg_lower)
            if match:
                return int(match.group(1))
        
        # Textual percentages
        if "setengah" in msg_lower or "separuh" in msg_lower:
            return 50
        if "sepertiga" in msg_lower:
            return 33
        if "seperempat" in msg_lower:
            return 25
        if "selesai" in msg_lower or "done" in msg_lower:
            return 100
        
        return None
    
    def _extract_course(self, message: str) -> Optional[str]:
        """Extract course name from message."""
        msg_lower = message.lower()
        
        for alias, variations in self.course_aliases.items():
            for var in variations:
                if var in msg_lower:
                    return alias
        
        return None
    
    def _extract_task(self, message: str, context: Dict) -> Optional[Dict]:
        """Extract task from message or context."""
        # Try extract from message
        course = self._extract_course(message)
        if course:
            return {"name": course, "id": None}
        
        # Fallback to context
        if context.get("active_task"):
            return context["active_task"]
        
        return None
    
    def _extract_scope(self, message: str) -> Optional[str]:
        """
        Extract scope of cancellation.
        Returns: "full_day" | "single_course" | None (ambiguous)
        """
        msg_lower = message.lower()
        
        # Full day indicators
        full_day_indicators = [
            "hari ini", "sehari", "full", "semua", "skip hari ini",
            "cancel hari ini", "libur hari ini", "gak kuliah hari ini"
        ]
        for indicator in full_day_indicators:
            if indicator in msg_lower:
                return "full_day"
        
        # Single course indicators
        single_indicators = [
            "aja", "saja", "doang", "cuma"
        ]
        for indicator in single_indicators:
            if indicator in msg_lower:
                return "single_course"
        
        # If specific course mentioned without full day indicator, likely single
        if self._extract_course(message) and not any(x in msg_lower for x in full_day_indicators):
            return "single_course"
        
        return None
    
    def _extract_reason(self, msg_lower: str) -> str:
        """Extract reason from message."""
        if "macet" in msg_lower:
            return "macet"
        elif "sakit" in msg_lower:
            return "sakit"
        elif "urusan" in msg_lower or "acara" in msg_lower:
            return "urusan mendadak"
        elif "ngantuk" in msg_lower or "ketiduran" in msg_lower:
            return "ngantuk"
        elif "dimarasi" in msg_lower:
            return "kerja di MARSI"
        elif "dikantor" in msg_lower or "di perusahaan" in msg_lower:
            return "kerja"
        else:
            return "alasan pribadi"
    
    def _extract_problem_type(self, msg_lower: str) -> str:
        """Extract type of problem."""
        if "macet" in msg_lower:
            return "macet"
        elif "sakit" in msg_lower:
            return "sakit"
        else:
            return "kendala"
    
    def _extract_task_info(self, message: str) -> Dict:
        """Extract task info from new task message."""
        msg_lower = message.lower()
        
        course = self._extract_course(message)
        
        # Try extract deadline
        deadline = None
        deadline_patterns = [
            r'deadline\s+(?:besok|hari ini|(?:\d+\s+hari lagi))',
            r'(?:besok|lusa|(?:\d+\s+hari lagi))'
        ]
        
        if "besok" in msg_lower:
            deadline = "besok"
        elif "lusa" in msg_lower:
            deadline = "lusa"
        elif "minggu" in msg_lower:
            deadline = "minggu depan"
        
        return {
            "course": course,
            "deadline": deadline,
            "raw": message
        }
    
    def _extract_task_selection(self, message: str, context: Dict) -> Optional[Dict]:
        """Extract task selection from reminder list."""
        msg_lower = message.lower()
        
        # Number selection: "1", "nomor 1", "yang pertama"
        number_match = re.search(r'(?:nomor\s*|no\s*|yang\s+ke?)?(\d+)', msg_lower)
        if number_match:
            return {
                "task_number": int(number_match.group(1)),
                "task_id": None,  # Will be resolved by handler
                "task_name": None
            }
        
        # Course selection: "kerjain kjk", "otw ngerjain komber"
        course = self._extract_course(message)
        if course:
            return {
                "task_number": None,
                "task_id": None,
                "task_name": course
            }
        
        return None
    
    def _is_create_task(self, msg_lower: str) -> bool:
        """Check if user wants to create/add a task."""
        for indicator in self.create_task_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_create_project(self, msg_lower: str) -> bool:
        """Check if user wants to create/add a project."""
        for indicator in self.create_project_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_create_transaction(self, msg_lower: str) -> bool:
        """Check if user wants to create/add a transaction."""
        for indicator in self.create_transaction_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _is_log_progress(self, msg_lower: str) -> bool:
        """Check if user wants to log project progress."""
        for indicator in self.log_progress_indicators:
            if indicator in msg_lower:
                return True
        return False
    
    def _extract_transaction_info(self, message: str) -> Dict:
        """Extract transaction info from message."""
        msg_lower = message.lower()
        
        # Detect type
        type_ = "expense"  # default
        if any(x in msg_lower for x in ["masuk", "terima", "dapet", "gajian", "income", "pemasukan"]):
            type_ = "income"
        
        # Extract amount
        amount = None
        amount_patterns = [
            r'rp\.?\s*([\d.,]+)',
            r'rp\s*([\d.,]+)',
            r'([\d.,]+)\s*ribu',
            r'([\d.,]+)\s*rb',
            r'([\d.,]+)\s*juta',
            r'([\d.,]+)\s*jt',
        ]
        
        for pattern in amount_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                amount_str = match.group(1).replace(',', '').replace('.', '')
                amount = float(amount_str)
                if "juta" in msg_lower or "jt" in msg_lower:
                    amount *= 1000000
                elif "ribu" in msg_lower or "rb" in msg_lower:
                    amount *= 1000
                break
        
        # Extract category
        categories = {
            "makan": "makan",
            "transport": "transport",
            "transportasi": "transport", 
            "bensin": "transport",
            "parkir": "transport",
            "kuliah": "kuliah",
            "print": "kuliah",
            "atk": "kuliah",
            "pulsa": "pulsa",
            "kuota": "pulsa",
            "entertainment": "hiburan",
            "hiburan": "hiburan",
            "nonton": "hiburan",
            "game": "hiburan",
            "belanja": "belanja"
        }
        
        category = "lainnya"
        for key, val in categories.items():
            if key in msg_lower:
                category = val
                break
        
        # Extract title
        title = None
        title_match = re.search(r'(?:beli|bayar|untuk)\s+(.+?)(?:\s+rp|$)', msg_lower)
        if title_match:
            title = title_match.group(1).strip()
        
        return {
            "type": type_,
            "amount": amount,
            "category": category,
            "title": title or category
        }
    
    # Public methods for clarification handling
    def extract_scope(self, message: str) -> Optional[str]:
        """Public method to extract scope (for clarification responses)."""
        return self._extract_scope(message)
    
    def extract_help_type(self, message: str) -> str:
        """Extract type of help needed."""
        msg_lower = message.lower()
        
        if "bab" in msg_lower or "teori" in msg_lower:
            return "bab_teori"
        elif "coding" in msg_lower or "implementasi" in msg_lower or "program" in msg_lower:
            return "coding"
        elif "sub" in msg_lower or "pecah" in msg_lower or "task" in msg_lower:
            return "breakdown"
        else:
            return "general"
