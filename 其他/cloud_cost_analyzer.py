import boto3
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import json
import numpy as np
from collections import defaultdict

class CloudCostAnalyzer:
    def __init__(self, cloud_provider: str = 'aws'):
        self.provider = cloud_provider
        self.client = self._initialize_client()
        self.cost_data = None
        
    def _initialize_client(self):
        """Initialize cloud provider client"""
        if self.provider == 'aws':
            return {
                'ce': boto3.client('ce'),
                'ec2': boto3.client('ec2'),
                'cloudwatch': boto3.client('cloudwatch'),
                's3': boto3.client('s3'),
                'rds': boto3.client('rds')
            }
        # Add support for other cloud providers as needed
        
    def analyze_costs(self, time_period: int = 30):
        """Comprehensive cost analysis"""
        print(f"Analyzing costs for the last {time_period} days...")
        
        analysis = {
            'total_cost': self._get_total_cost(time_period),
            'cost_by_service': self._analyze_by_service(time_period),
            'cost_by_resource': self._analyze_by_resource(time_period),
            'cost_trends': self._analyze_trends(time_period),
            'anomalies': self._detect_anomalies(time_period),
            'waste_analysis': self._identify_waste(),
            'optimization_opportunities': self._find_opportunities()
        }
        
        return self._generate_report(analysis)
    
    def _get_total_cost(self, days: int) -> float:
        """Get total cost for specified period"""
        if self.provider == 'aws':
            ce = self.client['ce']
            
            response = ce.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='DAILY',
                Metrics=['UnblendedCost']
            )
            
            total_cost = 0
            for result in response['ResultsByTime']:
                total_cost += float(result['Total']['UnblendedCost']['Amount'])
            
            return total_cost
    
    def _analyze_by_service(self, days: int) -> Dict:
        """Analyze costs by service"""
        if self.provider == 'aws':
            ce = self.client['ce']
            
            response = ce.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='DAILY',
                Metrics=['UnblendedCost'],
                GroupBy=[
                    {'Type': 'DIMENSION', 'Key': 'SERVICE'}
                ]
            )
            
            service_costs = defaultdict(list)
            for result in response['ResultsByTime']:
                for group in result['Groups']:
                    service = group['Keys'][0]
                    cost = float(group['Metrics']['UnblendedCost']['Amount'])
                    service_costs[service].append(cost)
            
            # Calculate analysis for each service
            analysis = {}
            total_cost = self._get_total_cost(days)
            
            for service, costs in service_costs.items():
                if costs:  # Only process services with costs
                    analysis[service] = {
                        'total': sum(costs),
                        'average_daily': sum(costs) / len(costs),
                        'trend': self._calculate_trend(costs),
                        'percentage': (sum(costs) / total_cost * 100) if total_cost > 0 else 0,
                        'volatility': np.std(costs) if len(costs) > 1 else 0
                    }
            
            return analysis
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction"""
        if len(values) < 2:
            return "insufficient_data"
        
        # Simple trend calculation
        first_half = values[:len(values)//2]
        second_half = values[len(values)//2:]
        
        first_avg = sum(first_half) / len(first_half)
        second_avg = sum(second_half) / len(second_half)
        
        if second_avg > first_avg * 1.1:
            return "increasing"
        elif second_avg < first_avg * 0.9:
            return "decreasing"
        else:
            return "stable"
    
    def _analyze_by_resource(self, days: int) -> Dict:
        """Analyze costs by resource type"""
        if self.provider == 'aws':
            ce = self.client['ce']
            
            response = ce.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='DAILY',
                Metrics=['UnblendedCost'],
                GroupBy=[
                    {'Type': 'DIMENSION', 'Key': 'RESOURCE_ID'}
                ]
            )
            
            resource_costs = {}
            for result in response['ResultsByTime']:
                for group in result['Groups']:
                    resource_id = group['Keys'][0]
                    cost = float(group['Metrics']['UnblendedCost']['Amount'])
                    
                    if resource_id not in resource_costs:
                        resource_costs[resource_id] = 0
                    resource_costs[resource_id] += cost
            
            # Sort by cost and return top consumers
            sorted_resources = sorted(resource_costs.items(), 
                                    key=lambda x: x[1], reverse=True)[:50]
            
            return dict(sorted_resources)
    
    def _analyze_trends(self, days: int) -> Dict:
        """Analyze cost trends"""
        if self.provider == 'aws':
            ce = self.client['ce']
            
            # Get weekly trend
            weekly_costs = []
            for week in range(4):  # Last 4 weeks
                start_date = datetime.now() - timedelta(days=7*(week+1))
                end_date = datetime.now() - timedelta(days=7*week)
                
                response = ce.get_cost_and_usage(
                    TimePeriod={
                        'Start': start_date.strftime('%Y-%m-%d'),
                        'End': end_date.strftime('%Y-%m-%d')
                    },
                    Granularity='WEEKLY',
                    Metrics=['UnblendedCost']
                )
                
                week_cost = 0
                for result in response['ResultsByTime']:
                    week_cost += float(result['Total']['UnblendedCost']['Amount'])
                
                weekly_costs.append(week_cost)
            
            weekly_costs.reverse()  # Chronological order
            
            return {
                'weekly_costs': weekly_costs,
                'trend_direction': self._calculate_trend(weekly_costs),
                'week_over_week_change': self._calculate_wow_change(weekly_costs),
                'volatility': np.std(weekly_costs) if len(weekly_costs) > 1 else 0
            }
    
    def _calculate_wow_change(self, weekly_costs: List[float]) -> float:
        """Calculate week-over-week percentage change"""
        if len(weekly_costs) < 2:
            return 0
        
        return ((weekly_costs[-1] - weekly_costs[-2]) / weekly_costs[-2] * 100) if weekly_costs[-2] > 0 else 0
    
    def _detect_anomalies(self, days: int) -> List[Dict]:
        """Detect cost anomalies"""
        anomalies = []
        
        # Get daily costs for anomaly detection
        if self.provider == 'aws':
            ce = self.client['ce']
            
            response = ce.get_cost_and_usage(
                TimePeriod={
                    'Start': (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
                    'End': datetime.now().strftime('%Y-%m-%d')
                },
                Granularity='DAILY',
                Metrics=['UnblendedCost']
            )
            
            daily_costs = []
            dates = []
            for result in response['ResultsByTime']:
                cost = float(result['Total']['UnblendedCost']['Amount'])
                daily_costs.append(cost)
                dates.append(result['TimePeriod']['Start'])
            
            if len(daily_costs) > 7:  # Need at least a week of data
                # Simple anomaly detection using standard deviation
                mean_cost = np.mean(daily_costs)
                std_cost = np.std(daily_costs)
                threshold = 2 * std_cost
                
                for i, (cost, date) in enumerate(zip(daily_costs, dates)):
                    if abs(cost - mean_cost) > threshold:
                        anomalies.append({
                            'date': date,
                            'cost': cost,
                            'expected_cost': mean_cost,
                            'deviation': abs(cost - mean_cost),
                            'type': 'spike' if cost > mean_cost else 'drop'
                        })
        
        return anomalies
    
    def _identify_waste(self) -> Dict:
        """Identify wasted resources"""
        waste_analysis = {
            'unused_resources': self._find_unused_resources(),
            'oversized_resources': self._find_oversized_resources(),
            'unattached_storage': self._find_unattached_storage(),
            'idle_load_balancers': self._find_idle_load_balancers(),
            'old_snapshots': self._find_old_snapshots(),
            'untagged_resources': self._find_untagged_resources()
        }
        
        total_waste = 0
        for category in waste_analysis.values():
            for item in category:
                total_waste += item.get('estimated_savings', 0)
        
        waste_analysis['total_potential_savings'] = total_waste
        
        return waste_analysis
    
    def _find_unused_resources(self) -> List[Dict]:
        """Find resources with no usage"""
        unused = []
        
        if self.provider == 'aws':
            ec2 = self.client['ec2']
            cloudwatch = self.client['cloudwatch']
            
            try:
                instances_response = ec2.describe_instances(
                    Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
                )
                
                for reservation in instances_response['Reservations']:
                    for instance in reservation['Instances']:
                        try:
                            # Check CPU utilization
                            metrics = cloudwatch.get_metric_statistics(
                                Namespace='AWS/EC2',
                                MetricName='CPUUtilization',
                                Dimensions=[
                                    {'Name': 'InstanceId', 'Value': instance['InstanceId']}
                                ],
                                StartTime=datetime.now() - timedelta(days=7),
                                EndTime=datetime.now(),
                                Period=3600,
                                Statistics=['Average']
                            )
                            
                            if metrics['Datapoints']:
                                avg_cpu = sum(d['Average'] for d in metrics['Datapoints']) / len(metrics['Datapoints'])
                                
                                if avg_cpu < 5:  # Less than 5% CPU usage
                                    unused.append({
                                        'resource_type': 'EC2 Instance',
                                        'resource_id': instance['InstanceId'],
                                        'reason': f'Average CPU: {avg_cpu:.2f}%',
                                        'estimated_savings': self._calculate_instance_cost(instance)
                                    })
                        except Exception as e:
                            print(f"Error checking instance {instance['InstanceId']}: {e}")
            except Exception as e:
                print(f"Error finding unused resources: {e}")
        
        return unused
    
    def _calculate_instance_cost(self, instance: Dict) -> float:
        """Calculate monthly cost of an EC2 instance"""
        # Simplified cost calculation - would need actual pricing data
        instance_type = instance.get('InstanceType', 'unknown')
        
        # Basic cost estimates (would need to be updated with current pricing)
        cost_map = {
            't2.micro': 8.5,
            't2.small': 17,
            't2.medium': 34,
            't3.micro': 7.5,
            't3.small': 15,
            't3.medium': 30,
            'm5.large': 70,
            'm5.xlarge': 140,
            'c5.large': 65,
            'c5.xlarge': 130
        }
        
        return cost_map.get(instance_type, 50)  # Default estimate
    
    def _find_oversized_resources(self) -> List[Dict]:
        """Find oversized resources"""
        # Placeholder implementation
        return []
    
    def _find_unattached_storage(self) -> List[Dict]:
        """Find unattached EBS volumes"""
        unattached = []
        
        if self.provider == 'aws':
            ec2 = self.client['ec2']
            
            try:
                volumes = ec2.describe_volumes(
                    Filters=[{'Name': 'status', 'Values': ['available']}]
                )
                
                for volume in volumes['Volumes']:
                    # Calculate cost
                    size_gb = volume['Size']
                    volume_type = volume['VolumeType']
                    
                    # Basic cost per GB per month
                    cost_per_gb = {
                        'gp2': 0.10,
                        'gp3': 0.08,
                        'io1': 0.125,
                        'io2': 0.125,
                        'st1': 0.045,
                        'sc1': 0.025
                    }
                    
                    monthly_cost = size_gb * cost_per_gb.get(volume_type, 0.10)
                    
                    unattached.append({
                        'resource_type': 'EBS Volume',
                        'resource_id': volume['VolumeId'],
                        'size_gb': size_gb,
                        'volume_type': volume_type,
                        'estimated_savings': monthly_cost
                    })
                    
            except Exception as e:
                print(f"Error finding unattached storage: {e}")
        
        return unattached
    
    def _find_idle_load_balancers(self) -> List[Dict]:
        """Find idle load balancers"""
        # Placeholder implementation
        return []
    
    def _find_old_snapshots(self) -> List[Dict]:
        """Find old snapshots that can be deleted"""
        old_snapshots = []
        
        if self.provider == 'aws':
            ec2 = self.client['ec2']
            
            try:
                # Find snapshots older than 30 days
                snapshots = ec2.describe_snapshots(OwnerIds=['self'])
                
                cutoff_date = datetime.now() - timedelta(days=30)
                
                for snapshot in snapshots['Snapshots']:
                    start_time = snapshot['StartTime'].replace(tzinfo=None)
                    
                    if start_time < cutoff_date:
                        # Estimate storage cost
                        volume_size = snapshot.get('VolumeSize', 0)
                        monthly_cost = volume_size * 0.05  # $0.05 per GB-month for snapshots
                        
                        old_snapshots.append({
                            'resource_type': 'EBS Snapshot',
                            'resource_id': snapshot['SnapshotId'],
                            'age_days': (datetime.now() - start_time).days,
                            'size_gb': volume_size,
                            'estimated_savings': monthly_cost
                        })
                        
            except Exception as e:
                print(f"Error finding old snapshots: {e}")
        
        return old_snapshots
    
    def _find_untagged_resources(self) -> List[Dict]:
        """Find resources without proper tags"""
        # Placeholder implementation
        return []
    
    def _find_opportunities(self) -> List[Dict]:
        """Find optimization opportunities"""
        opportunities = []
        
        # Rightsizing opportunities
        unused = self._find_unused_resources()
        if unused:
            total_savings = sum(r['estimated_savings'] for r in unused)
            opportunities.append({
                'category': 'rightsizing',
                'type': 'terminate_unused',
                'count': len(unused),
                'monthly_savings': total_savings,
                'effort': 'low',
                'risk': 'low'
            })
        
        # Storage optimization
        unattached = self._find_unattached_storage()
        if unattached:
            storage_savings = sum(v['estimated_savings'] for v in unattached)
            opportunities.append({
                'category': 'storage',
                'type': 'delete_unattached_volumes',
                'count': len(unattached),
                'monthly_savings': storage_savings,
                'effort': 'low',
                'risk': 'low'
            })
        
        # Snapshot cleanup
        old_snapshots = self._find_old_snapshots()
        if old_snapshots:
            snapshot_savings = sum(s['estimated_savings'] for s in old_snapshots)
            opportunities.append({
                'category': 'storage',
                'type': 'cleanup_old_snapshots',
                'count': len(old_snapshots),
                'monthly_savings': snapshot_savings,
                'effort': 'low',
                'risk': 'medium'
            })
        
        return sorted(opportunities, key=lambda x: x['monthly_savings'], reverse=True)
    
    def _generate_report(self, analysis: Dict) -> str:
        """Generate comprehensive cost analysis report"""
        report = []
        report.append("=" * 60)
        report.append("CLOUD COST ANALYSIS REPORT")
        report.append("=" * 60)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Total cost summary
        report.append("COST SUMMARY")
        report.append("-" * 20)
        report.append(f"Total Cost (30 days): ${analysis['total_cost']:.2f}")
        report.append(f"Daily Average: ${analysis['total_cost']/30:.2f}")
        
        # Trends
        trends = analysis['cost_trends']
        report.append(f"Weekly Trend: {trends['trend_direction']}")
        report.append(f"Week-over-Week Change: {trends['week_over_week_change']:.1f}%")
        report.append("")
        
        # Top services
        report.append("TOP 10 SERVICES BY COST")
        report.append("-" * 30)
        service_costs = analysis['cost_by_service']
        top_services = sorted(service_costs.items(), 
                            key=lambda x: x[1]['total'], reverse=True)[:10]
        
        for service, data in top_services:
            report.append(f"{service:<25} ${data['total']:>8.2f} ({data['percentage']:>5.1f}%)")
        report.append("")
        
        # Waste analysis
        waste = analysis['waste_analysis']
        report.append("WASTE ANALYSIS")
        report.append("-" * 15)
        report.append(f"Total Potential Savings: ${waste['total_potential_savings']:.2f}/month")
        
        if waste['unused_resources']:
            report.append(f"Unused Resources: {len(waste['unused_resources'])} instances")
        if waste['unattached_storage']:
            report.append(f"Unattached Volumes: {len(waste['unattached_storage'])} volumes")
        if waste['old_snapshots']:
            report.append(f"Old Snapshots: {len(waste['old_snapshots'])} snapshots")
        report.append("")
        
        # Top opportunities
        opportunities = analysis['optimization_opportunities']
        if opportunities:
            report.append("TOP OPTIMIZATION OPPORTUNITIES")
            report.append("-" * 35)
            for opp in opportunities[:5]:
                report.append(f"{opp['type']:<30} ${opp['monthly_savings']:>8.2f}/month")
        report.append("")
        
        # Anomalies
        anomalies = analysis['anomalies']
        if anomalies:
            report.append("RECENT COST ANOMALIES")
            report.append("-" * 22)
            for anomaly in anomalies[-5:]:  # Last 5 anomalies
                report.append(f"{anomaly['date']}: ${anomaly['cost']:.2f} ({anomaly['type']})")
        
        report.append("=" * 60)
        
        return "\n".join(report)

def main():
    """Main function to demonstrate cost analysis"""
    analyzer = CloudCostAnalyzer('aws')
    
    try:
        print("Starting cloud cost analysis...")
        report = analyzer.analyze_costs(30)
        print(report)
        
        # Save report to file
        with open('cost_analysis_report.txt', 'w') as f:
            f.write(report)
        print("\nReport saved to cost_analysis_report.txt")
        
    except Exception as e:
        print(f"Error during cost analysis: {e}")
        print("Make sure you have proper AWS credentials configured.")

if __name__ == "__main__":
    main()