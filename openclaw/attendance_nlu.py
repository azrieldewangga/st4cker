#!/usr/bin/env python3
"""
Attendance Intent Detector - AI-Based Natural Language Understanding
Mengerti konteks dan nuansa bahasa untuk attendance confirmation
"""

import re
from typing import Dict, Any, Optional
from datetime import datetime

class AttendanceIntentDetector:
    """
    Detector khusus untuk attendance intent dengan pemahaman konteks yang mendalam.
    Bukan cuma keyword matching, tapi mengerti:
    - "5 menit lg berangkat" = confirmed (with delay)
    - "otw" = confirmed
    - "skip dulu" = declined
    - "pindah besok" = rescheduled
    """
    
    def __init__(self):
        # Intent patterns dengan confidence scoring
        self.intent_patterns = {
            'confirmed': {
                'strong': [
                    r'\b(iya|yes|yoi|yup|ok|oke|okee|sip|siap|gas|gaskeun|otw|on the way|berangkat|jalan|go|lanjut)\b',
                    r'\b(berangkat|jalan|otw)\s+(sekarang|nya|nih|dong)',
                    r'\b(ok|oke)\s+(berangkat|jalan|gas)',
                ],
                'contextual': [
                    r'(\d+)\s*(menit|mnt|m|jam|j|hour|h)\s*(lagi|lg|nanti|ntar)\s*(berangkat|jalan|otw|datang|sampai)',
                    r'(berangkat|jalan|otw)\s*(\d+)\s*(menit|mnt|m|jam)\\s*(lagi|lg)',
                    r'(siap|gas|oke|ok)\s*(\d+)\s*(menit|mnt)\s*(lagi|lg)',
                    r'konfirmasi\s*(kehadiran|hadir)',
                    r'aku\s*(datang|hadir|berangkat|jalan)',
                    r'nya\s*(berangkat|jalan|datang)',
                    r'tetap\s*(berangkat|jalan|hadir)',
                ],
                'implicit': [
                    r'\b(siap|gas|gaskeun|yuk|ayo)\b',
                    r'\b(oke|ok|sip|baik)\s*$',  # Ending dengan oke
                ]
            },
            'declined': {
                'strong': [
                    r'\b(skip|lewat|gak|ga|tidak)\s*(jadi|datang|berangkat|hadir|ikut)',
                    r'\b(batal|cancel|gajadi|ga jadi|tidak jadi)\b',
                    r'\b(gak|ga|tidak)\s*(bisa|sanggup|sempat)\b',
                    r'\b(nggak|enggak|tidak)\s*(datang|berangkat|hadir)',
                ],
                'contextual': [
                    r'(skip|lewat)\s*(dulu|dlu|ya|yh)',
                    r'nggak\s*jadi\s*(datang|berangkat|ikut)',
                    r'tidak\s*(datang|berangkat|ikut|hadir)',
                    r'libur\s*(dulu|dlu)',
                    r'istirahat\s*(dulu|dlu)',
                ]
            },
            'rescheduled': {
                'strong': [
                    r'\b(pindah|geser|undur|maju|reschedule)\b',
                    r'\b(besok|nanti|later|tomorrow|next)\s*(aja|saja|ya)',
                ],
                'contextual': [
                    r'(pindah|geser)\s*(ke|kep)\s*(besok|nanti|jam|hari)',
                    r'(diundur|dimajukan)\s*(ke|jd|jadi)',
                    r'jam\s*(lain|berbeda|beda)',
                    r'hari\s*(lain|berbeda|beda)',
                    r'((\d+):(\d+))\s*(ya|aja|saja| boleh|ok)',  # Suggest new time
                ]
            }
        }
        
        # Negation patterns (untuk membedakan "iya skip" vs "iya")
        self.negation_patterns = [
            r'\b(tapi|tp|tpi)\s*(skip|batal|gak|cancel)',
            r'\b(iya|ok|oke)\s*(tapi|tp)\s*(skip|batal|gak jadi)',
            r'\b(maaf|sori|sorry)\s*(gak|ga|tidak)',
        ]
    
    def detect(self, message: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Detect attendance intent dari message.
        
        Returns:
            {
                "intent": "confirmed" | "declined" | "rescheduled" | "unknown",
                "confidence": float (0.0 - 1.0),
                "details": {
                    "delay_minutes": int | None,
                    "reason": str | None,
                    "suggested_time": str | None,
                    "original_message": str
                }
            }
        """
        msg_lower = message.lower().strip()
        context = context or {}
        
        # Check negation first
        if self._has_negation(msg_lower):
            return {
                "intent": "declined",
                "confidence": 0.9,
                "details": {
                    "reason": "explicit_negation",
                    "original_message": message
                }
            }
        
        # Check each intent
        results = []
        
        for intent_type, patterns in self.intent_patterns.items():
            confidence = self._calculate_confidence(msg_lower, patterns, context)
            if confidence > 0:
                results.append((intent_type, confidence))
        
        # Sort by confidence
        results.sort(key=lambda x: x[1], reverse=True)
        
        if not results or results[0][1] < 0.3:
            return {
                "intent": "unknown",
                "confidence": 0.0,
                "details": {
                    "original_message": message
                }
            }
        
        best_intent, best_confidence = results[0]
        
        # Extract additional details
        details = self._extract_details(msg_lower, best_intent)
        details["original_message"] = message
        details["confidence"] = best_confidence
        
        return {
            "intent": best_intent,
            "confidence": best_confidence,
            "details": details
        }
    
    def _has_negation(self, msg_lower: str) -> bool:
        """Check if message has negation that flips intent."""
        for pattern in self.negation_patterns:
            if re.search(pattern, msg_lower):
                return True
        return False
    
    def _calculate_confidence(self, msg_lower: str, patterns: Dict, context: Dict) -> float:
        """Calculate confidence score for intent."""
        confidence = 0.0
        
        # Strong patterns (high confidence)
        for pattern in patterns.get('strong', []):
            if re.search(pattern, msg_lower):
                confidence += 0.8
                break
        
        # Contextual patterns (medium confidence)
        for pattern in patterns.get('contextual', []):
            if re.search(pattern, msg_lower):
                confidence += 0.6
                break
        
        # Implicit patterns (lower confidence, need context)
        for pattern in patterns.get('implicit', []):
            if re.search(pattern, msg_lower):
                # Check if this is a response to reminder
                if context.get('awaiting_reply') or context.get('last_trigger') == 'schedule':
                    confidence += 0.5
                break
        
        return min(confidence, 1.0)
    
    def _extract_details(self, msg_lower: str, intent: str) -> Dict[str, Any]:
        """Extract additional details like delay time, reason, etc."""
        details = {
            "delay_minutes": None,
            "reason": None,
            "suggested_time": None
        }
        
        if intent == "confirmed":
            # Extract delay time
            delay_patterns = [
                r'(\d+)\s*(menit|mnt|m)\s*(lagi|lg)',
                r'(\d+)\s*(jam|j)\s*(lagi|lg)',
                r'(\d+)\s*(mnt|menit|m)',
            ]
            
            for pattern in delay_patterns:
                match = re.search(pattern, msg_lower)
                if match:
                    value = int(match.group(1))
                    unit = match.group(2) if len(match.groups()) > 1 else 'menit'
                    
                    if unit in ['jam', 'j', 'hour', 'h']:
                        details["delay_minutes"] = value * 60
                    else:
                        details["delay_minutes"] = value
                    break
        
        elif intent == "declined":
            # Extract reason
            reason_patterns = {
                "sakit": r'\b(sakit|flu|demam|pusing|tidak enak badan)',
                "macet": r'\b(macet|traffic|jalan macet)',
                "kerja": r'\b(kerja|kerjaan|marasi|dikantor|di kantor)',
                "ngantuk": r'\b(ngantuk|mager|magerr| males |males)',
                "urgent": r'\b(urgent|mendadak|penting|ada urusan)',
            }
            
            for reason, pattern in reason_patterns.items():
                if re.search(pattern, msg_lower):
                    details["reason"] = reason
                    break
        
        elif intent == "rescheduled":
            # Extract suggested time
            time_patterns = [
                r'(\d{1,2}):(\d{2})',
                r'(\d+)\s*(jam|j|menit|mnt)',
                r'(besok|nanti|sore|malam|siang)',
            ]
            
            for pattern in time_patterns:
                match = re.search(pattern, msg_lower)
                if match:
                    details["suggested_time"] = match.group(0)
                    break
        
        return details
    
    def is_attendance_related(self, message: str, context: Dict[str, Any] = None) -> bool:
        """Check if message is related to attendance (not other intents)."""
        result = self.detect(message, context)
        return result["confidence"] >= 0.5


# Singleton instance
detector = AttendanceIntentDetector()

def detect_attendance_intent(message: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
    """Utility function untuk detect attendance intent."""
    return detector.detect(message, context)
