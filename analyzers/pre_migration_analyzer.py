# -*- coding: utf-8 -*-
"""
Pre-Migration Analyzer
Analyzes firewall configuration and generates optimization/security report before conversion.
"""
from dataclasses import dataclass, asdict
from typing import List, Dict, Set, Optional
from models import FirewallConfig, Address, Service, Rule, Group, ServiceGroup


@dataclass
class DuplicateObject:
    """Represents a duplicate object found in config"""
    type: str  # 'address', 'service', 'group'
    original_name: str
    duplicate_names: List[str]
    value: str
    recommendation: str


@dataclass
class OverlappingRule:
    """Represents overlapping/shadowed rules"""
    rule_name: str
    rule_id: int
    shadowed_by: str
    shadowed_by_id: int
    reason: str
    recommendation: str


@dataclass
class SecurityRisk:
    """Represents security risk found in config"""
    severity: str  # 'critical', 'high', 'medium', 'low'
    category: str  # 'any-any-any', 'disabled-rule', 'no-logging', etc
    item_name: str
    description: str
    recommendation: str


@dataclass
class AnalysisReport:
    """Complete pre-migration analysis report"""
    # Statistics
    total_objects: int
    total_rules: int
    total_nat_rules: int
    
    # Findings
    duplicate_objects: List[DuplicateObject]
    overlapping_rules: List[OverlappingRule]
    security_risks: List[SecurityRisk]
    unused_objects: List[str]
    
    # Scores
    optimization_score: int  # 0-100
    security_score: int  # 0-100
    complexity_score: int  # 0-100
    overall_score: int  # 0-100
    
    # Recommendations
    recommendations: List[str]


class PreMigrationAnalyzer:
    """Analyzes firewall config and generates optimization report"""
    
    def __init__(self, config: FirewallConfig):
        self.config = config
    
    def analyze(self) -> AnalysisReport:
        """Run all analyses and generate comprehensive report"""
        duplicates = self._find_duplicate_objects()
        overlaps = self._find_overlapping_rules()
        risks = self._find_security_risks()
        unused = self._find_unused_objects()
        
        scores = self._calculate_scores(duplicates, overlaps, risks, unused)
        recommendations = self._generate_recommendations(duplicates, overlaps, risks)
        
        return AnalysisReport(
            total_objects=len(self.config.addresses) + len(self.config.services),
            total_rules=len(self.config.rules),
            total_nat_rules=len(self.config.nat_rules),
            duplicate_objects=duplicates,
            overlapping_rules=overlaps,
            security_risks=risks,
            unused_objects=unused,
            **scores,
            recommendations=recommendations
        )

    def _find_unused_objects(self) -> List[str]:
        """Identify unused objects and zero-hit rules"""
        unused = []
        
        # 1. Check for Zero-Hit Rules
        # Only run this check if at least one rule has a non-zero hit count (implies data exists)
        has_hit_data = any(r.hit_count > 0 for r in self.config.rules)
        
        if has_hit_data:
            for rule in self.config.rules:
                if rule.enabled and rule.hit_count == 0:
                    unused.append(f"Rule '{rule.name}' (0 hits) - Consider removing")
        
        # 2. Check for unused Address/Service objects (Future implementation)
        # We need a reference map to do this efficiently.
        # For now, we only focus on Hit Counts as requested.
        
        return unused
    
    def _find_duplicate_objects(self) -> List[DuplicateObject]:
        """Find duplicate address/service objects"""
        duplicates = []
        
        # Group addresses by value
        value_map: Dict[str, List[Address]] = {}
        for addr in self.config.addresses:
            key = self._get_address_key(addr)
            if key not in value_map:
                value_map[key] = []
            value_map[key].append(addr)
        
        # Identify duplicates
        for key, addrs in value_map.items():
            if len(addrs) > 1:
                duplicates.append(DuplicateObject(
                    type='address',
                    original_name=addrs[0].name,
                    duplicate_names=[a.name for a in addrs[1:]],
                    value=key,
                    recommendation=f"Keep '{addrs[0].name}', replace {len(addrs)-1} duplicate reference(s)"
                ))
        
        # Group services by value
        svc_value_map: Dict[str, List[Service]] = {}
        for svc in self.config.services:
            key = self._get_service_key(svc)
            if key not in svc_value_map:
                svc_value_map[key] = []
            svc_value_map[key].append(svc)
        
        # Identify service duplicates
        for key, svcs in svc_value_map.items():
            if len(svcs) > 1:
                duplicates.append(DuplicateObject(
                    type='service',
                    original_name=svcs[0].name,
                    duplicate_names=[s.name for s in svcs[1:]],
                    value=key,
                    recommendation=f"Keep '{svcs[0].name}', replace {len(svcs)-1} duplicate reference(s)"
                ))
        
        return duplicates
    
    def _get_address_key(self, addr: Address) -> str:
        """Generate unique key for address object"""
        if addr.type == 'host':
            return f"host:{addr.value1}"
        elif addr.type == 'network':
            return f"network:{addr.value1}/{addr.value2}"
        elif addr.type == 'range':
            return f"range:{addr.value1}-{addr.value2}"
        elif addr.type == 'fqdn':
            return f"fqdn:{addr.value1.lower()}"
        return f"unknown:{addr.value1}"
    
    def _get_service_key(self, svc: Service) -> str:
        """Generate unique key for service object"""
        protocol = svc.protocol.lower() if svc.protocol else 'tcp'
        port = svc.port if svc.port else 'any'
        return f"{protocol}:{port}"
    
    def _find_overlapping_rules(self) -> List[OverlappingRule]:
        """Detect rules that shadow/overlap other rules"""
        overlaps = []
        
        for i, rule1 in enumerate(self.config.rules):
            for j, rule2 in enumerate(self.config.rules):
                if i >= j:  # Only check rules that come after
                    continue
                
                if self._is_shadowing(rule1, rule2):
                    overlaps.append(OverlappingRule(
                        rule_name=rule2.name,
                        rule_id=j + 1,  # 1-indexed for user display
                        shadowed_by=rule1.name,
                        shadowed_by_id=i + 1,
                        reason=f"Broader rule at position {i+1} will match first",
                        recommendation=f"Move rule '{rule2.name}' above '{rule1.name}' or consolidate rules"
                    ))
        
        return overlaps
    
    def _is_shadowing(self, broader_rule: Rule, specific_rule: Rule) -> bool:
        """Check if broader_rule shadows specific_rule"""
        # Rule 1 shadows Rule 2 if:
        # - Same action
        # - Rule 1's source contains Rule 2's source (or is 'any')
        # - Rule 1's dest contains Rule 2's dest
        # - Rule 1's service contains Rule 2's service
        
        if broader_rule.action != specific_rule.action:
            return False
        
        # Check source
        if not self._is_subset_or_any(specific_rule.source, broader_rule.source):
            return False
        
        # Check destination
        if not self._is_subset_or_any(specific_rule.destination, broader_rule.destination):
            return False
        
        # Check service
        if not self._is_subset_or_any(specific_rule.service, broader_rule.service):
            return False
        
        return True
    
    def _is_subset_or_any(self, specific: Set, broader: Set) -> bool:
        """Check if specific is subset of broader (considering 'any')"""
        broader_lower = {str(x).lower() for x in broader} if broader else set()
        specific_lower = {str(x).lower() for x in specific} if specific else set()
        
        # If broader contains 'any' or 'all', it shadows everything
        if 'any' in broader_lower or 'all' in broader_lower:
            return True
        
        # If specific is empty and broader is not, it's not a subset
        if not specific_lower:
            return False
        
        # Check if all specific items are in broader
        return specific_lower.issubset(broader_lower)
    
    def _find_security_risks(self) -> List[SecurityRisk]:
        """Identify security risks in configuration"""
        risks = []
        
        # Check for Any-Any-Any rules
        for rule in self.config.rules:
            if self._is_any_any_any(rule):
                risks.append(SecurityRisk(
                    severity='critical',
                    category='any-any-any',
                    item_name=rule.name,
                    description=f"Rule allows ANY source → ANY destination → ANY service (unrestricted access)",
                    recommendation="Restrict at least one of: source, destination, or service to specific objects"
                ))
        
        # Check for disabled rules (cleanup opportunity)
        for rule in self.config.rules:
            if not rule.enabled:
                risks.append(SecurityRisk(
                    severity='low',
                    category='disabled-rule',
                    item_name=rule.name,
                    description="Rule is disabled and may be obsolete",
                    recommendation="Review and remove if no longer needed to reduce clutter"
                ))
        
        # Check for rules without logging
        for rule in self.config.rules:
            action_lower = rule.action.lower() if rule.action else ''
            if action_lower in ['allow', 'permit', 'accept']:
                if not rule.log:
                    risks.append(SecurityRisk(
                        severity='medium',
                        category='no-logging',
                        item_name=rule.name,
                        description="Allow rule has no logging enabled (audit trail gap)",
                        recommendation="Enable logging for security monitoring and compliance"
                    ))
        
        # Check for overly permissive services
        for rule in self.config.rules:
            action_lower = rule.action.lower() if rule.action else ''
            if action_lower in ['allow', 'permit', 'accept']:
                service_lower = {str(s).lower() for s in rule.service} if rule.service else set()
                if 'any' in service_lower or 'all' in service_lower:
                    risks.append(SecurityRisk(
                        severity='high',
                        category='any-service',
                        item_name=rule.name,
                        description="Rule allows ANY service/port (potential security gap)",
                        recommendation="Specify explicit services (HTTP, HTTPS, etc.) instead of 'any'"
                    ))
        
        # Check for rules without descriptions
        for rule in self.config.rules:
            if not rule.remark or rule.remark.strip() == '':
                risks.append(SecurityRisk(
                    severity='low',
                    category='no-description',
                    item_name=rule.name,
                    description="Rule has no description (reduces maintainability)",
                    recommendation="Add description explaining the rule's business purpose"
                ))
        
        return risks
    
    def _is_any_any_any(self, rule: Rule) -> bool:
        """Check if rule is Any-Any-Any"""
        # Check if action is allow
        action_lower = rule.action.lower() if rule.action else ''
        if action_lower not in ['allow', 'permit', 'accept']:
            return False
        
        # Check source
        src_lower = {str(s).lower() for s in rule.source} if rule.source else set()
        src_any = not rule.source or 'any' in src_lower or 'all' in src_lower
        
        # Check destination
        dst_lower = {str(d).lower() for d in rule.destination} if rule.destination else set()
        dst_any = not rule.destination or 'any' in dst_lower or 'all' in dst_lower
        
        # Check service
        svc_lower = {str(s).lower() for s in rule.service} if rule.service else set()
        svc_any = not rule.service or 'any' in svc_lower or 'all' in svc_lower
        
        return src_any and dst_any and svc_any
    
    def _calculate_scores(self, duplicates, overlaps, risks, unused) -> Dict[str, int]:
        """Calculate health scores (0-100)"""
        
        # Optimization Score (based on duplicates and unused)
        optimization_deductions = len(duplicates) * 5 + len(unused) * 2
        optimization_score = max(0, min(100, 100 - optimization_deductions))
        
        # Security Score (based on risks)
        security_deductions = 0
        for risk in risks:
            if risk.severity == 'critical':
                security_deductions += 20
            elif risk.severity == 'high':
                security_deductions += 10
            elif risk.severity == 'medium':
                security_deductions += 5
            else:  # low
                security_deductions += 2
        security_score = max(0, min(100, 100 - security_deductions))
        
        # Complexity Score (based on overlaps and total rules)
        complexity_deductions = len(overlaps) * 10
        total_rules = len(self.config.rules)
        if total_rules > 500:
            complexity_deductions += 20
        elif total_rules > 200:
            complexity_deductions += 10
        complexity_score = max(0, min(100, 100 - complexity_deductions))
        
        # Overall Score (weighted average)
        overall_score = int(
            (optimization_score * 0.25) +
            (security_score * 0.50) +
            (complexity_score * 0.25)
        )
        
        return {
            'optimization_score': optimization_score,
            'security_score': security_score,
            'complexity_score': complexity_score,
            'overall_score': overall_score
        }
    
    def _generate_recommendations(self, duplicates, overlaps, risks) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        if duplicates:
            dup_count = len(duplicates)
            addr_count = len([d for d in duplicates if d.type == 'address'])
            svc_count = len([d for d in duplicates if d.type == 'service'])
            
            if addr_count > 0:
                recommendations.append(
                    f"🔄 Consolidate {addr_count} duplicate address object(s) to simplify management"
                )
            if svc_count > 0:
                recommendations.append(
                    f"🔄 Consolidate {svc_count} duplicate service object(s) to reduce complexity"
                )
        
        if overlaps:
            recommendations.append(
                f"⚠️ Review {len(overlaps)} overlapping rule(s) to prevent unexpected shadowing"
            )
        
        critical_risks = [r for r in risks if r.severity == 'critical']
        if critical_risks:
            recommendations.append(
                f"🚨 Address {len(critical_risks)} critical security risk(s) before migration (Any-Any-Any rules)"
            )
        
        high_risks = [r for r in risks if r.severity == 'high']
        if high_risks:
            recommendations.append(
                f"⚠️ Fix {len(high_risks)} high-severity security issue(s) (overly permissive services)"
            )
        
        medium_risks = [r for r in risks if r.severity == 'medium']
        if medium_risks:
            recommendations.append(
                f"ℹ️ Enable logging for {len(medium_risks)} allow rule(s) to improve audit trail"
            )
        
        # Generic recommendation if score is low
        if not recommendations:
            recommendations.append("✅ Configuration looks healthy! Ready for migration.")
        
        return recommendations
