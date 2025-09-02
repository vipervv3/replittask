export default function TestApp() {
  console.log("TestApp rendering - if you see this in console, React works!");
  
  return (
    <div className="min-h-screen bg-blue-100 p-8">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          🎉 React App Works!
        </h1>
        <p className="text-gray-700 mb-4">
          If you can see this, the React app is working correctly.
        </p>
        <div className="space-y-2">
          <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
          <p><strong>Status:</strong> App is functioning</p>
        </div>
        <div className="mt-6">
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => console.log('Button clicked!')}
          >
            Test Button - Check Console
          </button>
        </div>
      </div>
    </div>
  );
}