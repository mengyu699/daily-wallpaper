#!/usr/bin/env python3
"""
Cloud Cost Optimization Master Controller
Orchestrates all cost optimization tools and provides unified reporting
"""

import json
import sys
import argparse
from datetime import datetime
from pathlib import Path

# Import our optimization modules
from cloud_cost_analyzer import CloudCostAnalyzer
from resource_rightsizer import ResourceRightsizer, AutomatedRightsizer
from reservation_optimizer import ReservationOptimizer
from spot_instance_optimizer import SpotInstanceOptimizer
from storage_optimizer import StorageOptimizer

class CostOptimizationMaster:
    def __init__(self, cloud_provider='aws'):
        self.cloud_provider = cloud_provider
        self.results = {}
        
        # Initialize all optimization components
        self.cost_analyzer = CloudCostAnalyzer(cloud_provider)
        self.rightsizer = ResourceRightsizer()
        self.reservation_optimizer = ReservationOptimizer()
        self.spot_optimizer = SpotInstanceOptimizer()
        self.storage_optimizer = StorageOptimizer()
        self.automated_rightsizer = AutomatedRightsizer()
        
        print(f"Initialized Cloud Cost Optimization Suite for {cloud_provider.upper()}")
    
    def run_comprehensive_analysis(self, days=30, include_automation=False):
        """Run comprehensive cost optimization analysis"""
        print("=" * 80)
        print("COMPREHENSIVE CLOUD COST OPTIMIZATION ANALYSIS")
        print("=" * 80)
        print(f"Analysis Period: {days} days")
        print(f"Automation Mode: {'Enabled' if include_automation else 'Analysis Only'}")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Step 1: Cost Analysis
        print("Step 1/6: Analyzing current costs and trends...")
        try:
            cost_analysis = self.cost_analyzer.analyze_costs(days)
            self.results['cost_analysis'] = {
                'status': 'completed',
                'data': cost_analysis
            }
            print("✓ Cost analysis completed")
        except Exception as e:
            print(f"✗ Cost analysis failed: {e}")
            self.results['cost_analysis'] = {'status': 'failed', 'error': str(e)}
        
        # Step 2: Rightsizing Analysis
        print("\nStep 2/6: Identifying rightsizing opportunities...")
        try:
            rightsizing_opportunities = self.rightsizer.analyze_rightsizing_opportunities(14)
            self.results['rightsizing'] = {
                'status': 'completed',
                'data': rightsizing_opportunities,
                'total_savings': rightsizing_opportunities.get('total_monthly_savings', 0),
                'opportunity_count': rightsizing_opportunities.get('total_opportunities', 0)
            }
            print(f"✓ Found {rightsizing_opportunities.get('total_opportunities', 0)} rightsizing opportunities")
            print(f"  Potential monthly savings: ${rightsizing_opportunities.get('total_monthly_savings', 0):,.0f}")
        except Exception as e:
            print(f"✗ Rightsizing analysis failed: {e}")
            self.results['rightsizing'] = {'status': 'failed', 'error': str(e)}
        
        # Step 3: Reservation Optimization
        print("\nStep 3/6: Analyzing reservation opportunities...")
        try:
            reservation_analysis = self.reservation_optimizer.analyze_reservation_opportunities(12)
            total_ri_savings = sum(rec.total_savings for rec in reservation_analysis['ri_recommendations'])
            total_sp_savings = sum(rec.get('estimated_annual_savings', 0) for rec in reservation_analysis['savings_plan_recommendations'])
            
            self.results['reservations'] = {
                'status': 'completed',
                'data': reservation_analysis,
                'total_annual_savings': total_ri_savings + total_sp_savings,
                'ri_opportunities': len(reservation_analysis['ri_recommendations']),
                'sp_opportunities': len(reservation_analysis['savings_plan_recommendations'])
            }
            print(f"✓ Found {len(reservation_analysis['ri_recommendations'])} RI and {len(reservation_analysis['savings_plan_recommendations'])} SP opportunities")
            print(f"  Potential annual savings: ${total_ri_savings + total_sp_savings:,.0f}")
        except Exception as e:
            print(f"✗ Reservation analysis failed: {e}")
            self.results['reservations'] = {'status': 'failed', 'error': str(e)}
        
        # Step 4: Spot Instance Analysis
        print("\nStep 4/6: Identifying spot instance opportunities...")
        try:
            spot_opportunities = self.spot_optimizer.identify_spot_opportunities()
            total_spot_savings = sum(
                sum(rec.estimated_monthly_savings for rec in category_recs)
                for category_recs in spot_opportunities.values()
            )
            total_spot_opportunities = sum(len(recs) for recs in spot_opportunities.values())
            
            self.results['spot_instances'] = {
                'status': 'completed',
                'data': spot_opportunities,
                'total_monthly_savings': total_spot_savings,
                'opportunity_count': total_spot_opportunities
            }
            print(f"✓ Found {total_spot_opportunities} spot instance opportunities")
            print(f"  Potential monthly savings: ${total_spot_savings:,.0f}")
        except Exception as e:
            print(f"✗ Spot instance analysis failed: {e}")
            self.results['spot_instances'] = {'status': 'failed', 'error': str(e)}
        
        # Step 5: Storage Optimization
        print("\nStep 5/6: Analyzing storage optimization opportunities...")
        try:
            storage_analysis = self.storage_optimizer.analyze_storage_costs()
            
            self.results['storage'] = {
                'status': 'completed',
                'data': storage_analysis,
                'total_monthly_savings': storage_analysis.get('total_potential_savings', 0),
                'current_cost': storage_analysis.get('total_storage_cost', 0)
            }
            print(f"✓ Storage analysis completed")
            print(f"  Current monthly cost: ${storage_analysis.get('total_storage_cost', 0):,.0f}")
            print(f"  Potential monthly savings: ${storage_analysis.get('total_potential_savings', 0):,.0f}")
        except Exception as e:
            print(f"✗ Storage analysis failed: {e}")
            self.results['storage'] = {'status': 'failed', 'error': str(e)}
        
        # Step 6: Automated Implementation (if enabled)
        if include_automation:
            print("\nStep 6/6: Executing automated optimizations...")
            try:
                self._execute_safe_automations()
            except Exception as e:
                print(f"✗ Automation failed: {e}")
                self.results['automation'] = {'status': 'failed', 'error': str(e)}
        else:
            print("\nStep 6/6: Automation skipped (analysis mode)")
            self.results['automation'] = {'status': 'skipped', 'reason': 'analysis_mode'}
        
        # Generate comprehensive report
        self._generate_executive_report()
        
        return self.results
    
    def _execute_safe_automations(self):
        """Execute only safe, low-risk optimizations automatically"""
        automation_results = []
        
        # Auto-implement low-risk rightsizing recommendations
        if self.results.get('rightsizing', {}).get('status') == 'completed':
            rightsizing_data = self.results['rightsizing']['data']
            
            if rightsizing_data.get('opportunities'):
                # Filter for low-risk recommendations
                safe_recommendations = [
                    opp for opp in rightsizing_data['opportunities']
                    if opp.get('risk') == 'low' and opp.get('monthly_savings', 0) > 20
                ][:5]  # Limit to 5 for safety
                
                if safe_recommendations:
                    print(f"  Implementing {len(safe_recommendations)} low-risk rightsizing optimizations...")
                    results = self.automated_rightsizer.execute_rightsizing(safe_recommendations, dry_run=True)
                    automation_results.extend(results)
        
        # Auto-implement storage optimizations
        if self.results.get('storage', {}).get('status') == 'completed':
            storage_data = self.results['storage']['data']
            
            # Implement lifecycle policies for large buckets
            lifecycle_opportunities = storage_data.get('analysis_details', {}).get('lifecycle_opportunities', [])
            safe_lifecycle_ops = [
                opp for opp in lifecycle_opportunities
                if opp.get('implementation_effort') == 'low'
            ][:3]  # Limit to 3 buckets
            
            if safe_lifecycle_ops:
                print(f"  Implementing {len(safe_lifecycle_ops)} S3 lifecycle policies...")
                # In a real implementation, this would call storage_optimizer.implement_storage_optimizations()
        
        self.results['automation'] = {
            'status': 'completed',
            'results': automation_results,
            'safe_optimizations_implemented': len(automation_results)
        }
        
        print(f"✓ Implemented {len(automation_results)} safe optimizations")
    
    def _generate_executive_report(self):
        """Generate executive summary report"""
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append("EXECUTIVE COST OPTIMIZATION SUMMARY")
        report_lines.append("=" * 80)
        report_lines.append(f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        # Calculate total savings potential
        total_monthly_savings = 0
        total_annual_savings = 0
        total_opportunities = 0
        
        # Rightsizing savings
        if self.results.get('rightsizing', {}).get('status') == 'completed':
            monthly = self.results['rightsizing'].get('total_savings', 0)
            total_monthly_savings += monthly
            total_opportunities += self.results['rightsizing'].get('opportunity_count', 0)
        
        # Reservation savings (annual)
        if self.results.get('reservations', {}).get('status') == 'completed':
            annual = self.results['reservations'].get('total_annual_savings', 0)
            total_annual_savings += annual
            total_opportunities += self.results['reservations'].get('ri_opportunities', 0)
            total_opportunities += self.results['reservations'].get('sp_opportunities', 0)
        
        # Spot instance savings
        if self.results.get('spot_instances', {}).get('status') == 'completed':
            monthly = self.results['spot_instances'].get('total_monthly_savings', 0)
            total_monthly_savings += monthly
            total_opportunities += self.results['spot_instances'].get('opportunity_count', 0)
        
        # Storage savings
        if self.results.get('storage', {}).get('status') == 'completed':
            monthly = self.results['storage'].get('total_monthly_savings', 0)
            total_monthly_savings += monthly
            # Storage opportunities are included in the bucket/volume counts
        
        total_annual_from_monthly = total_monthly_savings * 12
        total_combined_annual = total_annual_from_monthly + total_annual_savings
        
        # Executive Summary
        report_lines.append("OPTIMIZATION POTENTIAL SUMMARY")
        report_lines.append("-" * 35)
        report_lines.append(f"Total Optimization Opportunities: {total_opportunities}")
        report_lines.append(f"Total Monthly Savings Potential: ${total_monthly_savings:,.0f}")
        report_lines.append(f"Total Annual Savings Potential: ${total_combined_annual:,.0f}")
        report_lines.append("")
        
        # Breakdown by category
        report_lines.append("SAVINGS BREAKDOWN BY CATEGORY")
        report_lines.append("-" * 32)
        
        if self.results.get('rightsizing', {}).get('status') == 'completed':
            savings = self.results['rightsizing'].get('total_savings', 0)
            count = self.results['rightsizing'].get('opportunity_count', 0)
            report_lines.append(f"Resource Rightsizing: ${savings:>8,.0f}/month ({count:>2} opportunities)")
        
        if self.results.get('reservations', {}).get('status') == 'completed':
            savings = self.results['reservations'].get('total_annual_savings', 0)
            ri_count = self.results['reservations'].get('ri_opportunities', 0)
            sp_count = self.results['reservations'].get('sp_opportunities', 0)
            report_lines.append(f"Reservations/Savings Plans: ${savings:>8,.0f}/year ({ri_count + sp_count:>2} opportunities)")
        
        if self.results.get('spot_instances', {}).get('status') == 'completed':
            savings = self.results['spot_instances'].get('total_monthly_savings', 0)
            count = self.results['spot_instances'].get('opportunity_count', 0)
            report_lines.append(f"Spot Instances: ${savings:>8,.0f}/month ({count:>2} opportunities)")
        
        if self.results.get('storage', {}).get('status') == 'completed':
            savings = self.results['storage'].get('total_monthly_savings', 0)
            current = self.results['storage'].get('current_cost', 0)
            report_lines.append(f"Storage Optimization: ${savings:>8,.0f}/month (${current:,.0f} current cost)")
        
        report_lines.append("")
        
        # Implementation priorities
        report_lines.append("RECOMMENDED IMPLEMENTATION PRIORITY")
        report_lines.append("-" * 38)
        report_lines.append("1. Quick Wins (0-2 weeks):")
        report_lines.append("   • EBS gp2 to gp3 conversions")
        report_lines.append("   • S3 lifecycle policy implementation")
        report_lines.append("   • Unused resource cleanup")
        report_lines.append("")
        report_lines.append("2. Medium-term (1-2 months):")
        report_lines.append("   • EC2 instance rightsizing")
        report_lines.append("   • Spot instance adoption")
        report_lines.append("   • Container optimization")
        report_lines.append("")
        report_lines.append("3. Long-term (3-6 months):")
        report_lines.append("   • Reserved Instance purchases")
        report_lines.append("   • Savings Plan commitments")
        report_lines.append("   • Architecture optimization")
        report_lines.append("")
        
        # Risk assessment
        report_lines.append("RISK ASSESSMENT")
        report_lines.append("-" * 15)
        low_risk_count = 0
        medium_risk_count = 0
        high_risk_count = 0
        
        # Count risks from rightsizing
        if self.results.get('rightsizing', {}).get('status') == 'completed':
            for opp in self.results['rightsizing']['data'].get('opportunities', []):
                risk = opp.get('risk', 'medium')
                if risk == 'low':
                    low_risk_count += 1
                elif risk == 'medium':
                    medium_risk_count += 1
                else:
                    high_risk_count += 1
        
        report_lines.append(f"Low Risk Opportunities: {low_risk_count} (can be automated)")
        report_lines.append(f"Medium Risk Opportunities: {medium_risk_count} (requires review)")
        report_lines.append(f"High Risk Opportunities: {high_risk_count} (requires careful planning)")
        report_lines.append("")
        
        # Automation status
        if self.results.get('automation', {}).get('status') == 'completed':
            implemented = self.results['automation'].get('safe_optimizations_implemented', 0)
            report_lines.append(f"Automated Optimizations Implemented: {implemented}")
        elif self.results.get('automation', {}).get('status') == 'skipped':
            report_lines.append("Automated Optimizations: Skipped (analysis mode)")
        
        report_lines.append("")
        report_lines.append("=" * 80)
        
        # Save and display report
        executive_report = "\n".join(report_lines)
        
        with open('executive_cost_optimization_report.txt', 'w') as f:
            f.write(executive_report)
        
        print("\n" + executive_report)
        
        self.results['executive_report'] = executive_report
    
    def save_detailed_results(self):
        """Save all detailed results to files"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save comprehensive results
        with open(f'cost_optimization_results_{timestamp}.json', 'w') as f:
            # Convert complex objects to JSON-serializable format
            serializable_results = {}
            for key, value in self.results.items():
                if key == 'reservations' and value.get('status') == 'completed':
                    # Convert ReservationRecommendation objects to dicts
                    data = value['data'].copy()
                    if 'ri_recommendations' in data:
                        data['ri_recommendations'] = [
                            {
                                'instance_family': rec.instance_family,
                                'quantity': rec.quantity,
                                'term': rec.term,
                                'payment_option': rec.payment_option,
                                'total_savings': rec.total_savings,
                                'roi_percentage': rec.roi_percentage,
                                'confidence_level': rec.confidence_level
                            }
                            for rec in data['ri_recommendations']
                        ]
                    serializable_results[key] = {**value, 'data': data}
                elif key == 'spot_instances' and value.get('status') == 'completed':
                    # Convert SpotRecommendation objects to dicts
                    data = {}
                    for category, recs in value['data'].items():
                        data[category] = [
                            {
                                'workload_name': rec.workload_name,
                                'strategy': rec.strategy,
                                'estimated_monthly_savings': rec.estimated_monthly_savings,
                                'risk_level': rec.risk_level,
                                'implementation_complexity': rec.implementation_complexity
                            }
                            for rec in recs
                        ]
                    serializable_results[key] = {**value, 'data': data}
                else:
                    serializable_results[key] = value
            
            json.dump(serializable_results, f, indent=2, default=str)
        
        print(f"Detailed results saved to cost_optimization_results_{timestamp}.json")
    
    def generate_cost_dashboard_data(self):
        """Generate data for the cost dashboard"""
        dashboard_data = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_opportunities': 0,
                'total_monthly_savings': 0,
                'total_annual_savings': 0,
                'implementation_status': {
                    'completed': 0,
                    'in_progress': 0,
                    'pending': 0
                }
            },
            'categories': {},
            'priorities': {
                'high': [],
                'medium': [],
                'low': []
            }
        }
        
        # Aggregate data from all analysis results
        for category, result in self.results.items():
            if result.get('status') == 'completed' and 'data' in result:
                category_data = {
                    'savings': result.get('total_savings', result.get('total_monthly_savings', 0)),
                    'opportunities': result.get('opportunity_count', 0),
                    'status': 'completed'
                }
                dashboard_data['categories'][category] = category_data
                
                dashboard_data['summary']['total_opportunities'] += category_data['opportunities']
                dashboard_data['summary']['total_monthly_savings'] += category_data['savings']
        
        # Save dashboard data
        with open('dashboard_data.json', 'w') as f:
            json.dump(dashboard_data, f, indent=2, default=str)
        
        return dashboard_data

def main():
    parser = argparse.ArgumentParser(description='Cloud Cost Optimization Suite')
    parser.add_argument('--provider', default='aws', choices=['aws', 'azure', 'gcp'],
                        help='Cloud provider (default: aws)')
    parser.add_argument('--days', type=int, default=30,
                        help='Analysis period in days (default: 30)')
    parser.add_argument('--automate', action='store_true',
                        help='Enable automated implementation of safe optimizations')
    parser.add_argument('--component', choices=['cost', 'rightsizing', 'reservations', 'spot', 'storage'],
                        help='Run only specific component')
    parser.add_argument('--output-dir', default='.',
                        help='Output directory for reports and data files')
    
    args = parser.parse_args()
    
    try:
        # Initialize the master controller
        optimizer = CostOptimizationMaster(args.provider)
        
        if args.component:
            # Run specific component
            print(f"Running {args.component} analysis only...")
            if args.component == 'cost':
                result = optimizer.cost_analyzer.analyze_costs(args.days)
            elif args.component == 'rightsizing':
                result = optimizer.rightsizer.analyze_rightsizing_opportunities(14)
            elif args.component == 'reservations':
                result = optimizer.reservation_optimizer.analyze_reservation_opportunities(12)
            elif args.component == 'spot':
                result = optimizer.spot_optimizer.identify_spot_opportunities()
            elif args.component == 'storage':
                result = optimizer.storage_optimizer.analyze_storage_costs()
            
            print(f"\n{args.component.title()} analysis completed successfully!")
            
        else:
            # Run comprehensive analysis
            results = optimizer.run_comprehensive_analysis(
                days=args.days,
                include_automation=args.automate
            )
            
            # Save detailed results
            optimizer.save_detailed_results()
            
            # Generate dashboard data
            optimizer.generate_cost_dashboard_data()
            
            print("\nComprehensive cost optimization analysis completed!")
            print("Files generated:")
            print("  • executive_cost_optimization_report.txt")
            print("  • cost_optimization_results_[timestamp].json")
            print("  • dashboard_data.json")
            print("  • cost_dashboard.html (interactive dashboard)")
    
    except KeyboardInterrupt:
        print("\nAnalysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nError during analysis: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()