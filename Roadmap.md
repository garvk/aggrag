Items to do:

1. In the first phase, Run Flow API and UI flow does not always rely on same code. So there's duplication, which is not cool for scaling. 
    a. Firsty, We need to unify the code implementation of Run Flow API and UI Flow.
    b. Secondly, We need the responses from both flows to be Unified. So that the same UI can be used to display the responses generated by the API endpoints. For instance, a deployed iteration will generate a lot of different responses from different users, these unified responses will then be saved in a mongodb or redis, and retrieved in stored in .cforges cache so they can be displayed at will when an admin user requests. This will be very useful for evaluation of 'REAL' responses. 

2. Before Run Flow API is called we should have to run 'Validate Flow API' that will validate stuff like:
    a. Nodes to be executed and their order of execution
    b. Generate a (curl) request with 'placeholder' values of the user inputs needed for the flow
