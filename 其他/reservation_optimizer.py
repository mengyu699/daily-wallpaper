import boto3
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import statistics

@dataclass
class UsagePattern:
    instance_family: str
    average_usage: float
    min_usage: float
    max_usage: float
    percentile_25: float
    percentile_75: float
    coefficient_of_variation: float
    seasonal_factor: float
    growth_trend: str

@dataclass
class ReservationRecommendation:
    instance_family: str
    quantity: int
    term: str  # '1year' or '3year'
    payment_option: str  # 'no_upfront', 'partial_upfront', 'all_upfront'
    upfront_cost: float
    monthly_cost: float
    total_cost: float
    current_on_demand_cost: float
    total_savings: float
    roi_percentage: float
    break_even_months: int
    confidence_level: str

class ReservationOptimizer:
    def __init__(self):
        self.ce = boto3.client('ce')  # Cost Explorer
        self.ec2 = boto3.client('ec2')
        
        # Current RI pricing (simplified - would need real-time pricing API)
        self.ri_pricing = {
            'm5.large': {
                '1year': {'no_upfront': 0.063, 'partial_upfront': {'upfront': 276, 'hourly': 0.031}, 'all_upfront': 552},
                '3year': {'no_upfront': 0.045, 'partial_upfront': {'upfront': 594, 'hourly': 0.022}, 'all_upfront': 1188}
            },
            'm5.xlarge': {
                '1year': {'no_upfront': 0.126, 'partial_upfront': {'upfront': 552, 'hourly': 0.063}, 'all_upfront': 1104},
                '3year': {'no_upfront': 0.090, 'partial_upfront': {'upfront': 1188, 'hourly': 0.045}, 'all_upfront': 2376}
            },
            'c5.large': {
                '1year': {'no_upfront': 0.059, 'partial_upfront': {'upfront': 259, 'hourly': 0.029}, 'all_upfront': 518},
                '3year': {'no_upfront': 0.042, 'partial_upfront': {'upfront': 554, 'hourly': 0.021}, 'all_upfront': 1108}
            },
            'r5.large': {
                '1year': {'no_upfront': 0.088, 'partial_upfront': {'upfront': 386, 'hourly': 0.044}, 'all_upfront': 772},
                '3year': {'no_upfront': 0.063, 'partial_upfront': {'upfront': 829, 'hourly': 0.031}, 'all_upfront': 1658}
            },
            't3.medium': {
                '1year': {'no_upfront': 0.029, 'partial_upfront': {'upfront': 127, 'hourly': 0.014}, 'all_upfront': 254},
                '3year': {'no_upfront': 0.021, 'partial_upfront': {'upfront': 276, 'hourly': 0.010}, 'all_upfront': 552}
            }
        }
        
        # On-demand pricing
        self.on_demand_pricing = {
            'm5.large': 0.096,
            'm5.xlarge': 0.192,
            'c5.large': 0.085,
            'r5.large': 0.126,
            't3.medium': 0.0416
        }
        
        # Savings Plans pricing (simplified)
        self.savings_plan_discounts = {
            'compute': 0.66,  # Up to 66% discount
            'ec2_instance': 0.72  # Up to 72% discount
        }
    
    def analyze_reservation_opportunities(self, analysis_months: int = 12):
        """Comprehensive analysis of reservation opportunities"""
        print(f"Analyzing {analysis_months} months of usage data for reservation opportunities...")
        
        analysis = {
            'current_coverage': self._analyze_current_coverage(),
            'usage_patterns': self._analyze_usage_patterns(analysis_months),
            'ri_recommendations': [],
            'savings_plan_recommendations': [],
            'roi_analysis': {},
            'risk_assessment': {},
            'expiring_reservations': self._find_expiring_reservations()
        }
        
        # Generate recommendations based on usage patterns
        for pattern in analysis['usage_patterns']:
            if pattern.coefficient_of_variation < 0.15:  # Stable workload
                ri_recs = self._generate_ri_recommendations(pattern)
                analysis['ri_recommendations'].extend(ri_recs)
            elif pattern.coefficient_of_variation < 0.4:  # Moderately variable
                sp_recs = self._generate_savings_plan_recommendations(pattern)
                analysis['savings_plan_recommendations'].extend(sp_recs)
        
        # Calculate ROI and risk
        analysis['roi_analysis'] = self._calculate_portfolio_roi(analysis)
        analysis['risk_assessment'] = self._assess_commitment_risk(analysis)
        
        return analysis
    
    def _analyze_current_coverage(self) -> Dict:
        """Analyze current reservation coverage"""
        try:
            # Get current reservations
            reservations = self._get_current_reservations()
            
            # Get current usage
            usage = self._get_current_usage()
            
            # Calculate coverage
            coverage_data = {}
            total_usage_hours = 0
            total_reserved_hours = 0
            
            for instance_type, usage_hours in usage.items():
                reserved_hours = reservations.get(instance_type, 0)
                coverage_percentage = (reserved_hours / usage_hours * 100) if usage_hours > 0 else 0
                
                coverage_data[instance_type] = {
                    'usage_hours': usage_hours,
                    'reserved_hours': reserved_hours,
                    'coverage_percentage': coverage_percentage,
                    'on_demand_hours': max(0, usage_hours - reserved_hours)
                }
                
                total_usage_hours += usage_hours
                total_reserved_hours += reserved_hours
            
            overall_coverage = (total_reserved_hours / total_usage_hours * 100) if total_usage_hours > 0 else 0
            
            return {
                'overall_coverage_percentage': overall_coverage,
                'total_usage_hours': total_usage_hours,
                'total_reserved_hours': total_reserved_hours,
                'by_instance_type': coverage_data
            }
            
        except Exception as e:
            print(f"Error analyzing current coverage: {e}")
            return {'overall_coverage_percentage': 0, 'by_instance_type': {}}
    
    def _get_current_reservations(self) -> Dict[str, int]:
        """Get current active reservations by instance type"""
        try:
            response = self.ec2.describe_reserved_instances(
                Filters=[
                    {'Name': 'state', 'Values': ['active']}
                ]
            )
            
            reservations = {}
            for ri in response['ReservedInstances']:
                instance_type = ri['InstanceType']
                count = ri['InstanceCount']
                reservations[instance_type] = reservations.get(instance_type, 0) + count
            
            return reservations
            
        except Exception as e:
            print(f"Error getting current reservations: {e}")
            return {}
    
    def _get_current_usage(self) -> Dict[str, float]:
        """Get current instance usage by type"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        try:
            response = self.ce.get_dimension_values(
                Context='COST_AND_USAGE',
                Dimension='INSTANCE_TYPE',
                TimePeriod={
                    'Start': start_date.strftime('%Y-%m-%d'),
                    'End': end_date.strftime('%Y-%m-%d')
                }
            )
            
            usage = {}
            for item in response['DimensionValues']:
                instance_type = item['Value']
                # Get usage hours for this instance type
                usage_hours = self._get_usage_hours_for_type(instance_type, start_date, end_date)
                if usage_hours > 0:
                    usage[instance_type] = usage_hours
            
            return usage
            
        except Exception as e:
            print(f"Error getting current usage: {e}")
            return {}
    
    def _get_usage_hours_for_type(self, instance_type: str, start_date: datetime, end_date: datetime) -> float:
        """Get usage hours for specific instance type"""
        try:
            response = self.ce.get_cost_and_usage(
                TimePeriod={
                    'Start': start_date.strftime('%Y-%m-%d'),
                    'End': end_date.strftime('%Y-%m-%d')
                },
                Granularity='DAILY',
                Metrics=['UsageQuantity'],
                GroupBy=[
                    {'Type': 'DIMENSION', 'Key': 'INSTANCE_TYPE'}
                ],
                Filter={
                    'Dimensions': {
                        'Key': 'INSTANCE_TYPE',
                        'Values': [instance_type]
                    }
                }
            )
            
            total_hours = 0
            for result in response['ResultsByTime']:
                for group in result['Groups']:
                    if group['Keys'][0] == instance_type:
                        usage_qty = group['Metrics']['UsageQuantity']['Amount']
                        total_hours += float(usage_qty)
            
            return total_hours
            
        except Exception as e:
            print(f"Error getting usage hours for {instance_type}: {e}")
            return 0
    
    def _analyze_usage_patterns(self, months: int) -> List[UsagePattern]:
        """Analyze historical usage patterns"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30*months)
        
        patterns = []
        
        try:
            # Get usage data by instance type
            response = self.ce.get_cost_and_usage(
                TimePeriod={
                    'Start': start_date.strftime('%Y-%m-%d'),
                    'End': end_date.strftime('%Y-%m-%d')
                },
                Granularity='MONTHLY',
                Metrics=['UsageQuantity'],
                GroupBy=[
                    {'Type': 'DIMENSION', 'Key': 'INSTANCE_TYPE'}
                ]
            )
            
            # Organize usage data by instance type
            usage_by_type = {}
            for result in response['ResultsByTime']:
                for group in result['Groups']:
                    instance_type = group['Keys'][0]
                    usage = float(group['Metrics']['UsageQuantity']['Amount'])
                    
                    if instance_type not in usage_by_type:
                        usage_by_type[instance_type] = []
                    usage_by_type[instance_type].append(usage)
            
            # Analyze patterns for each instance type
            for instance_type, usage_data in usage_by_type.items():
                if len(usage_data) >= 3 and max(usage_data) > 100:  # Minimum data points and usage
                    pattern = self._calculate_usage_pattern(instance_type, usage_data)
                    patterns.append(pattern)
            
        except Exception as e:
            print(f"Error analyzing usage patterns: {e}")
        
        return patterns
    
    def _calculate_usage_pattern(self, instance_type: str, usage_data: List[float]) -> UsagePattern:
        """Calculate usage pattern statistics"""
        mean_usage = statistics.mean(usage_data)
        std_dev = statistics.stdev(usage_data) if len(usage_data) > 1 else 0
        coefficient_of_variation = (std_dev / mean_usage) if mean_usage > 0 else 0
        
        # Calculate percentiles
        percentile_25 = np.percentile(usage_data, 25)
        percentile_75 = np.percentile(usage_data, 75)
        
        # Determine growth trend
        if len(usage_data) >= 6:
            first_half = usage_data[:len(usage_data)//2]
            second_half = usage_data[len(usage_data)//2:]
            
            first_avg = statistics.mean(first_half)
            second_avg = statistics.mean(second_half)
            
            if second_avg > first_avg * 1.1:
                growth_trend = "increasing"
            elif second_avg < first_avg * 0.9:
                growth_trend = "decreasing"
            else:
                growth_trend = "stable"
        else:
            growth_trend = "insufficient_data"
        
        # Calculate seasonal factor (simplified)
        seasonal_factor = std_dev / mean_usage if mean_usage > 0 else 0
        
        return UsagePattern(
            instance_family=self._get_instance_family(instance_type),
            average_usage=mean_usage,
            min_usage=min(usage_data),
            max_usage=max(usage_data),
            percentile_25=percentile_25,
            percentile_75=percentile_75,
            coefficient_of_variation=coefficient_of_variation,
            seasonal_factor=seasonal_factor,
            growth_trend=growth_trend
        )
    
    def _get_instance_family(self, instance_type: str) -> str:
        """Extract instance family from instance type"""
        return instance_type.split('.')[0] if '.' in instance_type else instance_type
    
    def _generate_ri_recommendations(self, pattern: UsagePattern) -> List[ReservationRecommendation]:
        """Generate Reserved Instance recommendations"""
        recommendations = []
        
        # Determine optimal quantity (conservative approach)
        if pattern.growth_trend == "increasing":
            optimal_quantity = int(pattern.percentile_25)  # Conservative for growing workloads
        elif pattern.growth_trend == "decreasing":
            optimal_quantity = int(pattern.percentile_75)  # More aggressive for shrinking workloads
        else:
            optimal_quantity = int(pattern.average_usage * 0.8)  # 80% of average for stable workloads
        
        if optimal_quantity < 1:
            return recommendations
        
        # Generate recommendations for different terms and payment options
        for term in ['1year', '3year']:
            for payment_option in ['no_upfront', 'partial_upfront', 'all_upfront']:
                recommendation = self._calculate_ri_recommendation(
                    pattern, optimal_quantity, term, payment_option
                )
                if recommendation and recommendation.total_savings > 0:
                    recommendations.append(recommendation)
        
        # Sort by ROI
        recommendations.sort(key=lambda x: x.roi_percentage, reverse=True)
        
        return recommendations
    
    def _calculate_ri_recommendation(self, pattern: UsagePattern, quantity: int, 
                                   term: str, payment_option: str) -> ReservationRecommendation:
        """Calculate specific RI recommendation"""
        
        # Use a representative instance type for the family
        instance_type = f"{pattern.instance_family}.large"
        
        if instance_type not in self.ri_pricing:
            return None
        
        ri_prices = self.ri_pricing[instance_type][term][payment_option]
        on_demand_price = self.on_demand_pricing.get(instance_type, 0.1)
        
        # Calculate costs
        if payment_option == 'no_upfront':
            upfront_cost = 0
            hourly_cost = ri_prices
        elif payment_option == 'partial_upfront':
            upfront_cost = ri_prices['upfront'] * quantity
            hourly_cost = ri_prices['hourly']
        else:  # all_upfront
            upfront_cost = ri_prices * quantity
            hourly_cost = 0
        
        # Calculate term duration
        term_hours = 8760 if term == '1year' else 26280  # hours in 1 or 3 years
        
        # Total RI cost
        total_ri_cost = upfront_cost + (hourly_cost * term_hours * quantity)
        
        # Current on-demand cost
        current_on_demand_cost = on_demand_price * pattern.average_usage * term_hours
        
        # Savings calculation
        total_savings = current_on_demand_cost - total_ri_cost
        roi_percentage = (total_savings / total_ri_cost * 100) if total_ri_cost > 0 else 0
        
        # Break-even calculation
        monthly_ri_cost = total_ri_cost / (12 if term == '1year' else 36)
        monthly_on_demand_cost = current_on_demand_cost / (12 if term == '1year' else 36)
        monthly_savings = monthly_on_demand_cost - monthly_ri_cost
        
        break_even_months = (upfront_cost / monthly_savings) if monthly_savings > 0 else float('inf')
        
        # Confidence level
        confidence_level = self._calculate_confidence_level(pattern, term)
        
        return ReservationRecommendation(
            instance_family=pattern.instance_family,
            quantity=quantity,
            term=term,
            payment_option=payment_option,
            upfront_cost=upfront_cost,
            monthly_cost=hourly_cost * 730 * quantity,  # 730 hours per month
            total_cost=total_ri_cost,
            current_on_demand_cost=current_on_demand_cost,
            total_savings=total_savings,
            roi_percentage=roi_percentage,
            break_even_months=int(break_even_months) if break_even_months != float('inf') else -1,
            confidence_level=confidence_level
        )
    
    def _calculate_confidence_level(self, pattern: UsagePattern, term: str) -> str:
        """Calculate confidence level for recommendation"""
        # Factors affecting confidence
        stability_score = 1 - pattern.coefficient_of_variation
        growth_stability = 1 if pattern.growth_trend == "stable" else 0.7
        term_factor = 0.8 if term == '3year' else 1.0
        
        overall_confidence = stability_score * growth_stability * term_factor
        
        if overall_confidence > 0.8:
            return "high"
        elif overall_confidence > 0.6:
            return "medium"
        else:
            return "low"
    
    def _generate_savings_plan_recommendations(self, pattern: UsagePattern) -> List[Dict]:
        """Generate Savings Plan recommendations for variable workloads"""
        recommendations = []
        
        # Calculate baseline commitment (conservative)
        baseline_commitment = pattern.percentile_25 * 0.8  # 80% of 25th percentile
        
        if baseline_commitment < 0.01:  # Minimum $0.01/hour commitment
            return recommendations
        
        for plan_type in ['compute', 'ec2_instance']:
            for term in ['1year', '3year']:
                discount_rate = self.savings_plan_discounts[plan_type]
                
                # Calculate savings
                hourly_savings = baseline_commitment * discount_rate
                monthly_commitment = baseline_commitment * 730
                annual_savings = hourly_savings * 8760
                
                recommendations.append({
                    'type': 'savings_plan',
                    'plan_type': plan_type,
                    'instance_family': pattern.instance_family,
                    'term': term,
                    'hourly_commitment': baseline_commitment,
                    'monthly_commitment': monthly_commitment,
                    'estimated_annual_savings': annual_savings,
                    'discount_percentage': discount_rate * 100,
                    'flexibility_score': 0.9 if plan_type == 'compute' else 0.7,
                    'confidence_level': 'medium'
                })
        
        return recommendations
    
    def _find_expiring_reservations(self) -> List[Dict]:
        """Find reservations expiring in the next 90 days"""
        expiring = []
        
        try:
            response = self.ec2.describe_reserved_instances(
                Filters=[
                    {'Name': 'state', 'Values': ['active']}
                ]
            )
            
            ninety_days_from_now = datetime.now() + timedelta(days=90)
            
            for ri in response['ReservedInstances']:
                end_time = ri['End']
                if end_time <= ninety_days_from_now:
                    days_to_expiry = (end_time - datetime.now()).days
                    
                    expiring.append({
                        'reserved_instance_id': ri['ReservedInstancesId'],
                        'instance_type': ri['InstanceType'],
                        'instance_count': ri['InstanceCount'],
                        'expiry_date': end_time.strftime('%Y-%m-%d'),
                        'days_to_expiry': days_to_expiry,
                        'offering_type': ri['OfferingType'],
                        'scope': ri['Scope']
                    })
            
            # Sort by expiry date
            expiring.sort(key=lambda x: x['days_to_expiry'])
            
        except Exception as e:
            print(f"Error finding expiring reservations: {e}")
        
        return expiring
    
    def _calculate_portfolio_roi(self, analysis: Dict) -> Dict:
        """Calculate portfolio-level ROI analysis"""
        ri_recommendations = analysis['ri_recommendations']
        sp_recommendations = analysis['savings_plan_recommendations']
        
        # Calculate potential portfolio savings
        total_upfront_investment = sum(rec.upfront_cost for rec in ri_recommendations)
        total_annual_savings = sum(rec.total_savings / (1 if rec.term == '1year' else 3) 
                                 for rec in ri_recommendations)
        
        # Add Savings Plan savings
        total_annual_savings += sum(rec.get('estimated_annual_savings', 0) 
                                   for rec in sp_recommendations)
        
        portfolio_roi = (total_annual_savings / total_upfront_investment * 100) if total_upfront_investment > 0 else 0
        
        return {
            'total_upfront_investment': total_upfront_investment,
            'total_annual_savings': total_annual_savings,
            'portfolio_roi_percentage': portfolio_roi,
            'payback_period_months': (total_upfront_investment / (total_annual_savings / 12)) if total_annual_savings > 0 else float('inf')
        }
    
    def _assess_commitment_risk(self, analysis: Dict) -> Dict:
        """Assess risks associated with reservation commitments"""
        ri_recommendations = analysis['ri_recommendations']
        usage_patterns = analysis['usage_patterns']
        
        # Calculate risk factors
        high_risk_recommendations = [rec for rec in ri_recommendations 
                                   if rec.confidence_level == 'low' or rec.term == '3year']
        
        variable_workloads = [pattern for pattern in usage_patterns 
                            if pattern.coefficient_of_variation > 0.3]
        
        growing_workloads = [pattern for pattern in usage_patterns 
                           if pattern.growth_trend == "increasing"]
        
        risk_assessment = {
            'overall_risk_level': self._calculate_overall_risk_level(analysis),
            'high_risk_recommendations_count': len(high_risk_recommendations),
            'variable_workloads_count': len(variable_workloads),
            'growing_workloads_count': len(growing_workloads),
            'risk_factors': [],
            'mitigation_strategies': []
        }
        
        # Identify specific risks
        if len(variable_workloads) > len(usage_patterns) * 0.5:
            risk_assessment['risk_factors'].append("High workload variability")
            risk_assessment['mitigation_strategies'].append("Consider Savings Plans over Reserved Instances")
        
        if len(growing_workloads) > 0:
            risk_assessment['risk_factors'].append("Growing workloads may outpace reservations")
            risk_assessment['mitigation_strategies'].append("Use conservative reservation quantities")
        
        return risk_assessment
    
    def _calculate_overall_risk_level(self, analysis: Dict) -> str:
        """Calculate overall risk level for the portfolio"""
        ri_recommendations = analysis['ri_recommendations']
        usage_patterns = analysis['usage_patterns']
        
        if not ri_recommendations:
            return "low"
        
        # Calculate risk score
        high_confidence_recs = len([rec for rec in ri_recommendations if rec.confidence_level == 'high'])
        total_recs = len(ri_recommendations)
        confidence_ratio = high_confidence_recs / total_recs if total_recs > 0 else 0
        
        stable_patterns = len([p for p in usage_patterns if p.coefficient_of_variation < 0.2])
        total_patterns = len(usage_patterns) if usage_patterns else 1
        stability_ratio = stable_patterns / total_patterns
        
        overall_score = (confidence_ratio + stability_ratio) / 2
        
        if overall_score > 0.7:
            return "low"
        elif overall_score > 0.4:
            return "medium"
        else:
            return "high"
    
    def generate_optimization_report(self, analysis: Dict) -> str:
        """Generate comprehensive reservation optimization report"""
        report = []
        report.append("=" * 70)
        report.append("RESERVATION & SAVINGS PLAN OPTIMIZATION REPORT")
        report.append("=" * 70)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Current Coverage
        coverage = analysis['current_coverage']
        report.append("CURRENT RESERVATION COVERAGE")
        report.append("-" * 35)
        report.append(f"Overall Coverage: {coverage['overall_coverage_percentage']:.1f}%")
        report.append(f"Total Usage Hours: {coverage['total_usage_hours']:,.0f}")
        report.append(f"Total Reserved Hours: {coverage['total_reserved_hours']:,.0f}")
        report.append("")
        
        # Top RI Recommendations
        ri_recs = analysis['ri_recommendations'][:10]  # Top 10
        if ri_recs:
            report.append("TOP RESERVED INSTANCE RECOMMENDATIONS")
            report.append("-" * 40)
            report.append(f"{'Instance':<12} {'Qty':<4} {'Term':<6} {'Payment':<12} {'Savings':<10} {'ROI%':<6}")
            report.append("-" * 60)
            
            for rec in ri_recs:
                report.append(f"{rec.instance_family:<12} {rec.quantity:<4} {rec.term:<6} "
                            f"{rec.payment_option:<12} ${rec.total_savings:>8.0f} {rec.roi_percentage:>5.1f}%")
            report.append("")
        
        # Savings Plan Recommendations
        sp_recs = analysis['savings_plan_recommendations'][:5]  # Top 5
        if sp_recs:
            report.append("SAVINGS PLAN RECOMMENDATIONS")
            report.append("-" * 30)
            for rec in sp_recs:
                report.append(f"{rec['plan_type'].title()} Plan - {rec['term']}")
                report.append(f"  Hourly Commitment: ${rec['hourly_commitment']:.3f}")
                report.append(f"  Annual Savings: ${rec['estimated_annual_savings']:,.0f}")
                report.append(f"  Discount: {rec['discount_percentage']:.1f}%")
            report.append("")
        
        # ROI Analysis
        roi = analysis['roi_analysis']
        report.append("PORTFOLIO ROI ANALYSIS")
        report.append("-" * 22)
        report.append(f"Total Upfront Investment: ${roi['total_upfront_investment']:,.0f}")
        report.append(f"Total Annual Savings: ${roi['total_annual_savings']:,.0f}")
        report.append(f"Portfolio ROI: {roi['portfolio_roi_percentage']:.1f}%")
        if roi['payback_period_months'] != float('inf'):
            report.append(f"Payback Period: {roi['payback_period_months']:.1f} months")
        report.append("")
        
        # Risk Assessment
        risk = analysis['risk_assessment']
        report.append("RISK ASSESSMENT")
        report.append("-" * 15)
        report.append(f"Overall Risk Level: {risk['overall_risk_level'].upper()}")
        report.append(f"High Risk Recommendations: {risk['high_risk_recommendations_count']}")
        
        if risk['risk_factors']:
            report.append("\nRisk Factors:")
            for factor in risk['risk_factors']:
                report.append(f"  • {factor}")
        
        if risk['mitigation_strategies']:
            report.append("\nMitigation Strategies:")
            for strategy in risk['mitigation_strategies']:
                report.append(f"  • {strategy}")
        report.append("")
        
        # Expiring Reservations
        expiring = analysis['expiring_reservations']
        if expiring:
            report.append("EXPIRING RESERVATIONS (Next 90 Days)")
            report.append("-" * 35)
            for exp in expiring[:5]:  # Show first 5
                report.append(f"{exp['instance_type']} x{exp['instance_count']} - "
                            f"Expires {exp['expiry_date']} ({exp['days_to_expiry']} days)")
        
        report.append("=" * 70)
        
        return "\n".join(report)

def main():
    """Main function to demonstrate reservation optimization"""
    optimizer = ReservationOptimizer()
    
    try:
        print("Starting reservation optimization analysis...")
        analysis = optimizer.analyze_reservation_opportunities(12)
        
        # Generate and display report
        report = optimizer.generate_optimization_report(analysis)
        print("\n" + report)
        
        # Save detailed analysis to file
        with open('reservation_analysis.json', 'w') as f:
            # Convert complex objects to dict for JSON serialization
            serializable_analysis = {}
            for key, value in analysis.items():
                if key == 'ri_recommendations':
                    serializable_analysis[key] = [
                        {
                            'instance_family': rec.instance_family,
                            'quantity': rec.quantity,
                            'term': rec.term,
                            'payment_option': rec.payment_option,
                            'upfront_cost': rec.upfront_cost,
                            'monthly_cost': rec.monthly_cost,
                            'total_savings': rec.total_savings,
                            'roi_percentage': rec.roi_percentage,
                            'confidence_level': rec.confidence_level
                        }
                        for rec in value
                    ]
                elif key == 'usage_patterns':
                    serializable_analysis[key] = [
                        {
                            'instance_family': pattern.instance_family,
                            'average_usage': pattern.average_usage,
                            'coefficient_of_variation': pattern.coefficient_of_variation,
                            'growth_trend': pattern.growth_trend
                        }
                        for pattern in value
                    ]
                else:
                    serializable_analysis[key] = value
            
            json.dump(serializable_analysis, f, indent=2, default=str)
        
        print(f"\nDetailed analysis saved to reservation_analysis.json")
        
        # Summary statistics
        ri_count = len(analysis['ri_recommendations'])
        sp_count = len(analysis['savings_plan_recommendations'])
        total_savings = analysis['roi_analysis']['total_annual_savings']
        
        print(f"\nSummary:")
        print(f"  Reserved Instance Opportunities: {ri_count}")
        print(f"  Savings Plan Opportunities: {sp_count}")
        print(f"  Total Annual Savings Potential: ${total_savings:,.0f}")
        
    except Exception as e:
        print(f"Error during reservation optimization: {e}")
        print("Make sure you have proper AWS credentials and Cost Explorer access.")

if __name__ == "__main__":
    main()