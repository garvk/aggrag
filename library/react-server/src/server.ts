import app from "./backend/flow";

const port = process.env.PORT_EXPRESS || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
