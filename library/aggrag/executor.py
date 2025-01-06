import json
from collections import defaultdict

class NodeExecutor:
    def __init__(self):
        self.executed = set()
        self.results = {}
        self.error_nodes = set()
        self.iteration_config = None
        self.iteration_data = None

    def add_iteration(self, config_file_path):
        self.iteration_config = config_file_path

    def load_iteration(self):
        if not self.iteration_config:
            return f"iteration file not configured"

        with open(self.iteration_config, "r") as file:
            iteration = json.load(file)

        self.iteration_data = iteration
        
        return iteration

    def build_execution_graph(self, nodes, edges):
        # Create adjacency list
        graph = defaultdict(list)
        dependencies = defaultdict(set)
        
        for edge in edges:
            source, target = edge['source'], edge['target']
            graph[source].append(target)
            dependencies[target].add(source)
            
        return graph, dependencies
                
    def build_dependency_graph(self):

        self.load_iteration()
        
        if not self.iteration_data:
            return f"iteration file not loaded."
        
        nodes = {node['id']: node for node in self.iteration_data['flow']['nodes']}
        edges = self.iteration_data['flow']['edges']
        
        # Create adjacency lists
        dependencies = defaultdict(set)
        dependents = defaultdict(set)
        
        for edge in edges:
            source = edge['source']
            target = edge['target']
            dependencies[target].add(source)  # Target depends on source
            dependents[source].add(target)    # Source has target as dependent
            
        return {
            'nodes': nodes,
            'dependencies': dependencies,
            'dependents': dependents
        }

    def identify_output_nodes(self, nodes, edges):
        """
        I suppose the outgoing nodes can be identified as the ones that dont have a target

        OR

        Any of the Visualiser nodes can be considered as Output Nodes. 
        Example: InspectNode is needed for a response to be returned.
        
        
        """
        # Find terminal nodes (no outgoing edges)
        output_nodes = set(nodes.keys())
        for edge in edges:
            output_nodes.discard(edge['source'])
        return output_nodes
    
    def get_execution_order(self, dependency_graph):
        nodes = dependency_graph['nodes']
        dependencies = dependency_graph['dependencies']
        
        # Find nodes with no dependencies (starting points)
        ready_nodes = [
            node_id for node_id in nodes 
            if not dependencies[node_id]
        ]
        
        execution_order = []
        while ready_nodes:
            current_node = ready_nodes.pop(0)
            execution_order.append(current_node)
            
            # Update dependencies and find newly ready nodes
            for dependent in dependency_graph['dependents'][current_node]:
                dependencies[dependent].remove(current_node)
                if not dependencies[dependent]:
                    ready_nodes.append(dependent)
                    
        return execution_order


    def identify_parallel_groups(self, dependency_graph, execution_order):
        parallel_groups = []
        current_group = []
        
        for node_id in execution_order:
            node_dependencies = dependency_graph['dependencies'][node_id]
            
            # Check if node can be added to current parallel group
            can_parallel = all(
                dep in set().union(*parallel_groups) 
                for dep in node_dependencies
            )
            
            if can_parallel:
                current_group.append(node_id)
            else:
                if current_group:
                    parallel_groups.append(current_group)
                current_group = [node_id]
                
        if current_group:
            parallel_groups.append(current_group)
            
        return parallel_groups

    def detect_cycles(self, dependency_graph):
        visited = set()
        path = set()
        
        def dfs(node):
            if node in path:
                return True  # Cycle detected
            if node in visited:
                return False
                
            path.add(node)
            visited.add(node)
            
            for dependent in dependency_graph['dependents'][node]:
                if dfs(dependent):
                    return True
                    
            path.remove(node)
            return False
            
        return any(dfs(node) for node in dependency_graph['nodes'])

    def validate_graph_structure(self, nodes, edges):
        # Verify all edge endpoints exist
        node_ids = {node['id'] for node in nodes}
        for edge in edges:
            if edge['source'] not in node_ids:
                raise ValueError(f"Invalid edge source: {edge['source']}")
            if edge['target'] not in node_ids:
                raise ValueError(f"Invalid edge target: {edge['target']}")
                
        # Check for cycles
        if detect_cycles(build_dependency_graph({'nodes': nodes, 'edges': edges})):
            raise ValueError("Cyclic dependencies detected in flow")

    def update_execution_order(self, dependency_graph, completed_nodes):
        # Recalculate ready nodes based on completion status
        ready_nodes = [
            node_id for node_id, deps in dependency_graph['dependencies'].items()
            if deps.issubset(completed_nodes) and node_id not in completed_nodes
        ]
        return ready_nodes
    
    def can_execute(self, node_id, dependencies):
        # Check if all dependencies are satisfied
        return all(dep in self.executed for dep in dependencies[node_id])

    
    def collect_results(self, node_id):

        """
        Where does self.results come from?
        """
        node_result = self.results.get(node_id, {})
        return {
            'node_id': node_id,
            'status': 'completed' if node_id in self.executed else 'skipped',
            'data': node_result.get('data'),
            'error': node_result.get('error'),
            'execution_time': node_result.get('execution_time')
        }
    
    def analyze_graph(self, cforge_data):
        # 1. Extract nodes and edges
        nodes = cforge_data['flow']['nodes']
        edges = cforge_data['flow']['edges']
        
        # 2. Validate graph structure
        self.validate_graph(nodes, edges)
        
        # 3. Build dependency map
        graph, dependencies = self.build_execution_graph(nodes, edges)
        
        # 4. Identify entry and exit points
        entry_nodes = self.find_entry_nodes(dependencies)
        exit_nodes = self.find_exit_nodes(graph)
        
        return {
            'graph': graph,
            'dependencies': dependencies,
            'entry_nodes': entry_nodes,
            'exit_nodes': exit_nodes
        }

    def prepare_resources(self, nodes):
        required_resources = {
            'llm_models': set(),
            'rag_stores': set(),
            'file_dependencies': set()
        }
        
        for node in nodes:
            if node['type'] == 'prompt':
                required_resources['llm_models'].update(
                    model['name'] for model in node['data']['llms']
                )
            elif node['type'] == 'processor':
                required_resources['rag_stores'].update(
                    rag['name'] for rag in node['data'].get('rags', [])
                )
        
        return required_resources